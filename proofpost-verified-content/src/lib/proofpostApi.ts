// ProofPost client-side API adapter.
// Communicates with backend HTTP API at http://localhost:3001 with dynamic fallback to in-browser execution.

export type Platform = "x_thread" | "linkedin_post" | "newsletter_blurb";

export interface OrderRequirements {
  sourceText: string;
  platform: Platform;
  requiredHashtags?: string[];
  bannedWords?: string[];
}

export interface Claim {
  claimSentence: string;
  matchedSourceSentence: string | null;
  overlapScore: number;
  numbersInClaim: string[];
  numbersMatchedInSource: boolean;
  grounded: boolean;
}

export interface ProofBundle {
  lengthOk: boolean;
  hashtagsOk: boolean;
  bannedWordsOk: boolean;
  claims: Claim[];
  allClaimsGrounded: boolean;
  overallPass: boolean;
  resultHash: string;
}

export interface Delivery {
  orderId: string;
  platform: Platform;
  content: string;
  proof: ProofBundle;
  paymentTx?: string;
  deliveryTx?: string;
  timestamp: string;
}

export const GROUND_THRESHOLD = 0.35;
export const X_LIMIT = 280;
export const NEWSLETTER_LIMIT = 600;
export const LINKEDIN_LIMIT = 3000;

const BACKEND_URL = "http://localhost:3001";

// Simple client-side status checker
export async function checkBackendStatus(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${BACKEND_URL}/api/history`, { 
      method: "GET",
      signal: controller.signal
    });
    clearTimeout(id);
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------- In-Browser Fallback Engine ----------------

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","of","in","on","at","to","for","with","by",
  "is","are","was","were","be","been","being","it","this","that","these","those",
  "as","from","has","have","had","do","does","did","will","would","can","could",
  "should","may","might","our","their","its","his","her","we","they","he","she",
  "them","us","you","your","i","me","my","not","no",
]);

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractNumbers(s: string): string[] {
  const matches = s.match(/\d+(?:\.\d+)?%?/g) ?? [];
  return matches.map((m) => m.replace(/%$/, ""));
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w && !STOP_WORDS.has(w) && w.length > 1),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0) return 0;
  let hits = 0;
  a.forEach((w) => {
    if (b.has(w)) hits++;
  });
  return hits / Math.max(a.size, 1);
}

const CLAIM_KEYWORDS = ["best","most","first","record","largest","fastest","top","only","highest","lowest","never","always"];

function isClaim(sentence: string): boolean {
  if (/\d/.test(sentence)) return true;
  const lower = sentence.toLowerCase();
  return CLAIM_KEYWORDS.some((k) => new RegExp(`\\b${k}\\b`).test(lower));
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function formatXThread(sentences: string[], hashtags: string[]): string {
  const tagLine = hashtags.length ? " " + hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ") : "";
  const chunks: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + " " + s).trim().length > X_LIMIT - 12) {
      if (buf) chunks.push(buf.trim());
      buf = s;
    } else {
      buf = (buf + " " + s).trim();
    }
  }
  if (buf) chunks.push(buf.trim());
  const total = chunks.length;
  return chunks
    .map((c, i) => {
      const prefix = `${i + 1}/${total} `;
      const suffix = i === total - 1 ? tagLine : "";
      let body = c;
      const max = X_LIMIT - prefix.length - suffix.length;
      if (body.length > max) body = body.slice(0, max - 1) + "…";
      return prefix + body + suffix;
    })
    .join("\n---\n");
}

function formatLinkedIn(sentences: string[], hashtags: string[]): string {
  if (sentences.length === 0) return "";
  const hook = `**${sentences[0]}**`;
  const rest = sentences.slice(1).join(" ");
  const tagLine = hashtags.length ? "\n\n" + hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ") : "";
  let body = `${hook}\n\n${rest}`.trim();
  if (body.length > LINKEDIN_LIMIT - tagLine.length) {
    body = body.slice(0, LINKEDIN_LIMIT - tagLine.length - 1) + "…";
  }
  return body + tagLine;
}

function formatNewsletter(sentences: string[], hashtags: string[]): string {
  const scored = sentences
    .map((s) => ({ s, score: (/\d/.test(s) ? 2 : 0) + (/%/.test(s) ? 1 : 0) + (CLAIM_KEYWORDS.some((k) => s.toLowerCase().includes(k)) ? 1 : 0) }))
    .sort((a, b) => b.score - a.score);
  const picked: string[] = [];
  let len = 0;
  const tagLine = hashtags.length ? " " + hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ") : "";
  const budget = NEWSLETTER_LIMIT - tagLine.length;
  for (const { s } of scored) {
    if (len + s.length + 1 > budget) continue;
    picked.push(s);
    len += s.length + 1;
  }
  const original = sentences.filter((s) => picked.includes(s));
  return (original.join(" ") + tagLine).trim();
}

export async function runClientSideMock(
  req: OrderRequirements,
  opts: GenerateOptions = {}
): Promise<Delivery> {
  const sentences = splitSentences(req.sourceText);
  let content = "";
  switch (req.platform) {
    case "x_thread":
      content = formatXThread(sentences, req.requiredHashtags ?? []);
      break;
    case "linkedin_post":
      content = formatLinkedIn(sentences, req.requiredHashtags ?? []);
      break;
    case "newsletter_blurb":
      content = formatNewsletter(sentences, req.requiredHashtags ?? []);
      break;
  }

  if (opts.fabricate) {
    content = content.replace(/(\d+(?:\.\d+)?)(%?)/, (_m, n: string, pct: string) => {
      const bumped = Math.min(99, Math.round(Number(n) + 50));
      return `${bumped}${pct}`;
    });
  }

  let lengthOk = true;
  if (req.platform === "x_thread") {
    lengthOk = content.split(/\n---\n/).every((seg) => seg.length <= X_LIMIT);
  } else if (req.platform === "newsletter_blurb") {
    lengthOk = content.length <= NEWSLETTER_LIMIT;
  } else {
    lengthOk = content.length <= LINKEDIN_LIMIT;
  }

  const lowerContent = content.toLowerCase();
  const hashtagsOk = (req.requiredHashtags ?? []).every((h) => {
    const tag = (h.startsWith("#") ? h : `#${h}`).toLowerCase();
    return lowerContent.includes(tag);
  });

  const bannedWordsOk = (req.bannedWords ?? []).every(
    (w) => !new RegExp(`\\b${w.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i").test(content),
  );

  const contentForClaims = content.replace(/\*\*/g, "").replace(/^\d+\/\d+\s+/gm, "");
  const claimSentences = splitSentences(contentForClaims).filter(isClaim);
  const sourceTokens = sentences.map((s) => ({ s, t: tokenize(s), nums: extractNumbers(s) }));

  const claims: Claim[] = claimSentences.map((cs) => {
    const ct = tokenize(cs);
    const cn = extractNumbers(cs);
    let best: { s: string; score: number; nums: string[] } | null = null;
    for (const src of sourceTokens) {
      const score = overlap(ct, src.t);
      if (!best || score > best.score) best = { s: src.s, score, nums: src.nums };
    }
    const overlapScore = best?.score ?? 0;
    const numbersMatchedInSource = cn.every((n) => best?.nums.includes(n));
    const grounded = overlapScore >= GROUND_THRESHOLD && numbersMatchedInSource;
    return {
      claimSentence: cs,
      matchedSourceSentence: best && best.score > 0 ? best.s : null,
      overlapScore,
      numbersInClaim: cn,
      numbersMatchedInSource,
      grounded,
    };
  });

  const allClaimsGrounded = claims.every((c) => c.grounded);
  const overallPass = lengthOk && hashtagsOk && bannedWordsOk && allClaimsGrounded;
  const resultHash = await sha256Hex(
    JSON.stringify({ content, lengthOk, hashtagsOk, bannedWordsOk, claims, overallPass }),
  );

  const orderId = "ord_" + Math.random().toString(36).slice(2, 10);
  const fakeTx = () =>
    "0x" +
    Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

  return {
    orderId,
    platform: req.platform,
    content,
    proof: {
      lengthOk,
      hashtagsOk,
      bannedWordsOk,
      claims,
      allClaimsGrounded,
      overallPass,
      resultHash,
    },
    paymentTx: fakeTx(),
    deliveryTx: fakeTx(),
    timestamp: new Date().toISOString(),
  };
}

const MOCK_HISTORY: Delivery[] = [
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

// ---------------- API Actions ----------------

export interface GenerateOptions {
  fabricate?: boolean;
  mode?: "mock" | "local" | "croo";
}

export async function generateAndVerify(
  req: OrderRequirements,
  opts: GenerateOptions = {},
): Promise<Delivery> {
  const mode = opts.mode ?? "local";

  if (mode === "mock") {
    console.log("[proofpostApi] Running in client-side Mock Mode");
    return runClientSideMock(req, opts);
  }

  try {
    console.log(`[proofpostApi] Sending generate request to backend (${mode})...`);
    const res = await fetch(`${BACKEND_URL}/api/generate-and-verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requirements: req,
        options: {
          fabricate: opts.fabricate,
          mode
        }
      })
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.error || `HTTP error ${res.status}`);
    }

    return await res.json();
  } catch (err: any) {
    console.warn("[proofpostApi] Backend server request failed. Falling back to client-side Mock Engine.", err);
    // Propagate the specific backend CROO config errors to help development, otherwise fallback
    if (err.message && (err.message.includes("Missing SERVICE_ID") || err.message.includes("escrow") || err.message.includes("timed out"))) {
      throw err;
    }
    return runClientSideMock(req, opts);
  }
}

export async function getOrderHistory(): Promise<Delivery[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/history`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("[proofpostApi] Failed to fetch history from backend. Falling back to client-side mock list.", err);
    return MOCK_HISTORY;
  }
}
