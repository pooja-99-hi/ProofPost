import { AgentClient, EventType } from "@croo-network/sdk";
import { loadConfig } from "../src/config";
import { generateContent } from "../src/generate";
import { parseRequirements } from "../src/orderHandler";
import { reverifyDelivery } from "../src/verify";

function parseList(value: string | undefined): string[] | undefined {
  if (!value || value.trim().length === 0) {
    return undefined;
  }
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

async function waitForOrderLifecycle(client: AgentClient, serviceId: string, requirementsJson: string): Promise<void> {
  const negotiation = await client.negotiateOrder({ serviceId, requirements: requirementsJson });
  const negotiationId = negotiation.negotiationId;
  console.log(`[requester] negotiated ${negotiationId}`);

  const stream = await client.connectWebSocket();
  let paidOrderId: string | null = null;

  stream.on(EventType.OrderCreated, async (event) => {
    if (!event.order_id || paidOrderId) {
      return;
    }

    paidOrderId = event.order_id;
    try {
      await client.payOrder(event.order_id);
      console.log(`[requester] paid order ${event.order_id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[requester] pay failed for ${event.order_id}: ${message}`);
    }
  });

  stream.on(EventType.OrderCompleted, async (event) => {
    const orderId = event.order_id ?? paidOrderId;
    if (!orderId) {
      return;
    }

    try {
      const order = await client.getOrder(orderId);
      const delivery = await client.getDelivery(orderId);
      const payload = JSON.parse(delivery.deliverableSchema);
      const requirements = parseRequirements(requirementsJson);
      const localProof = reverifyDelivery(payload, {
        sourceText: requirements.sourceText,
        requiredHashtags: requirements.requiredHashtags,
        bannedWords: requirements.bannedWords,
      });

      const match = payload.proof.resultHash === localProof.resultHash && localProof.overallPass;
      console.log(`[requester] ${match ? "MATCH" : "MISMATCH"} for order ${order.orderId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[requester] verification failed for ${orderId}: ${message}`);
      console.log("[requester] MISMATCH");
    }
  });
}

export async function runRequester(): Promise<void> {
  const config = loadConfig();
  const serviceId = process.env.SERVICE_ID?.trim();
  if (!serviceId) {
    throw new Error("Missing SERVICE_ID. Copy it from your configured CROO service in the agent.croo.network Dashboard.");
  }

  const sourceText = process.env.REQUESTER_SOURCE_TEXT?.trim() ?? "ProofPost keeps claims grounded in the original source text.";
  const platform = (process.env.REQUESTER_PLATFORM?.trim() ?? "x_thread") as "x_thread" | "linkedin_post" | "newsletter_blurb";
  const requiredHashtags = parseList(process.env.REQUESTER_REQUIRED_HASHTAGS);
  const bannedWords = parseList(process.env.REQUESTER_BANNED_WORDS);

  const requirementsJson = JSON.stringify({
    sourceText,
    platform,
    requiredHashtags,
    bannedWords,
  });

  const client = new AgentClient({ baseURL: config.crooApiUrl, wsURL: config.crooWsUrl }, config.crooSdkKey);
  await waitForOrderLifecycle(client, serviceId, requirementsJson);
}

if (require.main === module) {
  runRequester().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[requester] fatal: ${message}`);
    process.exitCode = 1;
  });
}