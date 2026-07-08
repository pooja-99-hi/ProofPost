import http from "http";
import fs from "fs";
import path from "path";
import { generateContent } from "./generate";
import { buildProofBundle, reverifyDelivery } from "./verify";
import { loadConfig } from "./config";
import { runProvider } from "./provider";
import { AgentClient, EventType } from "@croo-network/sdk";

// Try to parse a local .env file manually at startup if it exists
function tryLoadEnv() {
  try {
    const envPath = path.join(__dirname, "../.env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const idx = trimmed.indexOf("=");
        if (idx > 0) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
          process.env[key] = val;
        }
      }
      console.log("[server] Loaded environment from local .env");
    }
  } catch (err) {
    console.warn("[server] Failed to parse .env file:", err);
  }
}

tryLoadEnv();

const PORT = 3001;

// Seed some initial mock history items so the UI isn't empty
const historyStore: any[] = [
  {
    orderId: "ord_a1b2c3d4",
    platform: "x_thread",
    content: "1/2 Q3 revenue grew 42% year over year.\n---\n2/2 That beats analyst estimates of 30%. #earnings",
    proof: {
      lengthOk: true,
      hashtagsOk: true,
      bannedWordsOk: true,
      claims: [],
      allClaimsGrounded: true,
      overallPass: true,
      resultHash: "9f2b1c8e4a7d3f6b2e5c1a9d8b4f7c3e6a2d1b5f8c9e4a7d3f6b2e5c1a9d8b4f",
    },
    paymentTx: "0x4a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
    deliveryTx: "0x1f2e3d4c5b6a7980e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4",
    timestamp: new Date(Date.now() - 3600_000 * 5).toISOString(),
  },
  {
    orderId: "ord_e5f6g7h8",
    platform: "linkedin_post",
    content: "**We shipped v2.** Our team of 12 engineers built the fastest release yet.",
    proof: {
      lengthOk: true,
      hashtagsOk: true,
      bannedWordsOk: true,
      claims: [
        {
          claimSentence: "Our team of 12 engineers built the fastest release yet.",
          matchedSourceSentence: null,
          overlapScore: 0.15,
          numbersInClaim: ["12"],
          numbersMatchedInSource: false,
          grounded: false,
        }
      ],
      allClaimsGrounded: false,
      overallPass: false,
      resultHash: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b",
    },
    paymentTx: "0x9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d",
    deliveryTx: "0x2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a",
    timestamp: new Date(Date.now() - 3600_000 * 26).toISOString(),
  },
];

// Helper to run local generation & verification
function executeLocalFlow(requirements: any, options: { fabricate?: boolean }): any {
  let postsContent = generateContent(requirements.sourceText, requirements.platform, {
    requiredHashtags: requirements.requiredHashtags
  });

  if (options.fabricate) {
    postsContent.posts = postsContent.posts.map((post) => {
      return {
        ...post,
        text: post.text.replace(/(\d+(?:\.\d+)?)(%?)/, (_m, n: string, pct: string) => {
          const bumped = Math.min(99, Math.round(Number(n) + 50));
          return `${bumped}${pct}`;
        })
      };
    });
  }

  const proof = buildProofBundle(postsContent, {
    sourceText: requirements.sourceText,
    requiredHashtags: requirements.requiredHashtags,
    bannedWords: requirements.bannedWords
  });

  const mappedProof = {
    lengthOk: proof.lengthChecks.every((c) => c.pass),
    hashtagsOk: proof.hashtagCheck.pass,
    bannedWordsOk: proof.bannedWordsCheck.pass,
    claims: proof.claimGrounding.map((cg) => ({
      claimSentence: cg.claim,
      matchedSourceSentence: cg.matchedSourceSpan,
      overlapScore: cg.overlapScore,
      numbersInClaim: cg.numbersInClaim,
      numbersMatchedInSource: cg.numbersMatchedInSource,
      grounded: cg.grounded,
    })),
    allClaimsGrounded: proof.claimGrounding.every((cg) => cg.grounded),
    overallPass: proof.overallPass,
    resultHash: proof.resultHash,
  };

  const delivery = {
    orderId: "ord_" + Math.random().toString(36).slice(2, 10),
    platform: requirements.platform,
    content: postsContent.posts.map((p) => p.text).join("\n---\n"),
    proof: mappedProof,
    paymentTx: "0x" + Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join(""),
    deliveryTx: "0x" + Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join(""),
    timestamp: new Date().toISOString()
  };

  historyStore.unshift(delivery);
  return delivery;
}

// Helper to run on-chain CROO generation & verification flow
async function executeCrooFlow(requirements: any, options: { fabricate?: boolean }): Promise<any> {
  const config = loadConfig();
  const serviceId = process.env.SERVICE_ID?.trim();
  if (!serviceId) {
    throw new Error("Missing SERVICE_ID in environment configuration.");
  }

  const client = new AgentClient({ baseURL: config.crooApiUrl, wsURL: config.crooWsUrl }, config.crooSdkKey);
  const requirementsJson = JSON.stringify({
    sourceText: requirements.sourceText,
    platform: requirements.platform,
    requiredHashtags: requirements.requiredHashtags,
    bannedWords: requirements.bannedWords,
  });

  console.log(`[server-requester] negotiating order for service ${serviceId}...`);
  const negotiation = await client.negotiateOrder({ serviceId, requirements: requirementsJson });
  const negotiationId = negotiation.negotiationId;
  console.log(`[server-requester] negotiation created: ${negotiationId}`);

  const stream = await client.connectWebSocket();

  return new Promise((resolve, reject) => {
    let orderId: string | null = null;
    const timeout = setTimeout(() => {
      stream.close();
      reject(new Error("CROO order flow timed out (60s). Is the background provider online?"));
    }, 60000);

    stream.on(EventType.OrderCreated, async (event) => {
      if (!event.order_id || orderId) return;
      orderId = event.order_id;
      try {
        console.log(`[server-requester] order created: ${orderId}. Paying escrow...`);
        await client.payOrder(orderId);
      } catch (err) {
        clearTimeout(timeout);
        stream.close();
        reject(err);
      }
    });

    stream.on(EventType.OrderCompleted, async (event) => {
      const completedOrderId = event.order_id ?? orderId;
      if (!completedOrderId || completedOrderId !== orderId) return;
      
      try {
        console.log(`[server-requester] order completed: ${completedOrderId}. Fetching delivery...`);
        clearTimeout(timeout);
        stream.close();

        const order = await client.getOrder(completedOrderId);
        const deliveryData = await client.getDelivery(completedOrderId);
        const payload = JSON.parse(deliveryData.deliverableSchema);

        // If fabrication is requested, simulate fabrication in the returned content
        if (options.fabricate) {
          payload.content.posts = payload.content.posts.map((post: any) => {
            const hasNumber = /\d/.test(post.text);
            if (hasNumber) {
              return {
                ...post,
                text: post.text.replace(/\b(\d+(?:\.\d+)?)\b/, (v: any) => String(Number(v) * 2.2))
              };
            }
            return post;
          });
        }

        const localProof = reverifyDelivery(payload, {
          sourceText: requirements.sourceText,
          requiredHashtags: requirements.requiredHashtags,
          bannedWords: requirements.bannedWords,
        });

        const mappedProof = {
          lengthOk: localProof.lengthChecks.every((c: any) => c.pass),
          hashtagsOk: localProof.hashtagCheck.pass,
          bannedWordsOk: localProof.bannedWordsCheck.pass,
          claims: localProof.claimGrounding.map((cg: any) => ({
            claimSentence: cg.claim,
            matchedSourceSentence: cg.matchedSourceSpan,
            overlapScore: cg.overlapScore,
            numbersInClaim: cg.numbersInClaim,
            numbersMatchedInSource: cg.numbersMatchedInSource,
            grounded: cg.grounded,
          })),
          allClaimsGrounded: localProof.claimGrounding.every((cg: any) => cg.grounded),
          overallPass: localProof.overallPass && (payload.proof.resultHash === localProof.resultHash),
          resultHash: localProof.resultHash,
        };

        const resultDelivery = {
          orderId: completedOrderId,
          platform: requirements.platform,
          content: payload.content.posts.map((p: any) => p.text).join("\n---\n"),
          proof: mappedProof,
          paymentTx: order.payTxHash ?? "0x" + "0".repeat(64),
          deliveryTx: order.deliverTxHash ?? "0x" + "0".repeat(64),
          timestamp: new Date().toISOString(),
        };

        historyStore.unshift(resultDelivery);
        resolve(resultDelivery);
      } catch (err) {
        clearTimeout(timeout);
        stream.close();
        reject(err);
      }
    });
  });
}

// Create the HTTP server
const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url ?? "", `http://localhost:${PORT}`);

  if (req.method === "GET" && parsedUrl.pathname === "/api/history") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(historyStore));
    return;
  }

  if (req.method === "POST" && parsedUrl.pathname === "/api/generate-and-verify") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);
        const { requirements, options } = payload;

        if (!requirements || !requirements.sourceText || !requirements.platform) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing sourceText or platform in requirements" }));
          return;
        }

        const mode = options?.mode ?? "local";

        if (mode === "croo") {
          try {
            const delivery = await executeCrooFlow(requirements, options);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(delivery));
          } catch (crooErr: any) {
            console.error("[server] CROO Order Flow failed:", crooErr);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: crooErr.message || "CROO Flow Failed" }));
          }
        } else {
          // Local direct flow
          const delivery = executeLocalFlow(requirements, options);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(delivery));
        }
      } catch (err: any) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Malformed JSON payload: " + err.message }));
      }
    });
    return;
  }

  // Not found
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
});

// Boot the server
server.listen(PORT, () => {
  console.log(`[server] ProofPost Backend API online at http://localhost:${PORT}`);

  // Automatically start the background provider agent if credentials are available
  try {
    const config = loadConfig();
    if (config.crooSdkKey && config.crooApiUrl && config.crooWsUrl) {
      console.log("[server] Starting background CROO provider agent WebSocket listener...");
      runProvider()
        .then(() => {
          console.log("[server] Background CROO provider agent loop running.");
        })
        .catch((err) => {
          console.error("[server] Background CROO provider agent encountered error:", err);
        });
    } else {
      console.log("[server] Background provider offline: CROO env credentials incomplete.");
    }
  } catch (e) {
    console.log("[server] Background provider offline: CROO env variables are missing.");
  }
});
