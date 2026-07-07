import { AgentClient, EventType } from "@croo-network/sdk";
import { loadConfig } from "./config";
import { fulfillOrder, parseRequirements, toDeliverOrderRequest } from "./orderHandler";

async function handleNegotiationCreated(client: AgentClient, negotiationId?: string): Promise<void> {
  if (!negotiationId) {
    throw new Error("NegotiationCreated event did not include negotiation_id.");
  }

  await client.acceptNegotiation(negotiationId);
}

async function handleOrderPaid(client: AgentClient, orderId?: string): Promise<void> {
  if (!orderId) {
    throw new Error("OrderPaid event did not include order_id.");
  }

  const order = await client.getOrder(orderId);
  const negotiation = await client.getNegotiation(order.negotiationId);
  const requirements = parseRequirements(negotiation.requirements);
  const payload = fulfillOrder(requirements);
  await client.deliverOrder(orderId, toDeliverOrderRequest(payload));
}

export async function runProvider(): Promise<void> {
  const config = loadConfig();
  const client = new AgentClient({ baseURL: config.crooApiUrl, wsURL: config.crooWsUrl }, config.crooSdkKey);
  const stream = await client.connectWebSocket();

  stream.on(EventType.NegotiationCreated, async (event) => {
    try {
      await handleNegotiationCreated(client, event.negotiation_id);
      console.log(`[provider] accepted negotiation ${event.negotiation_id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[provider] negotiation handler failed: ${message}`);
      if (event.negotiation_id) {
        try {
          await client.rejectNegotiation(event.negotiation_id, message);
        } catch (rejectError) {
          const rejectMessage = rejectError instanceof Error ? rejectError.message : String(rejectError);
          console.error(`[provider] failed to reject negotiation ${event.negotiation_id}: ${rejectMessage}`);
        }
      }
    }
  });

  stream.on(EventType.OrderPaid, async (event) => {
    if (!event.order_id) {
      console.error("[provider] OrderPaid event did not include order_id.");
      return;
    }

    try {
      await handleOrderPaid(client, event.order_id);
      console.log(`[provider] delivered order ${event.order_id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[provider] fulfillment failed for ${event.order_id}: ${message}`);
      try {
        await client.rejectOrder(event.order_id, message);
      } catch (rejectError) {
        const rejectMessage = rejectError instanceof Error ? rejectError.message : String(rejectError);
        console.error(`[provider] failed to reject order ${event.order_id}: ${rejectMessage}`);
      }
    }
  });

  console.log("[provider] online");
}

if (require.main === module) {
  runProvider().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[provider] fatal: ${message}`);
    process.exitCode = 1;
  });
}