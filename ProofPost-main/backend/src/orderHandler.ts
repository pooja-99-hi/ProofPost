import { generateContent } from "./generate";
import type { DeliveryPayload, Platform } from "./proofSchema";
import { buildProofBundle } from "./verify";

export interface OrderRequirements {
  sourceText: string;
  platform: Platform;
  requiredHashtags?: string[];
  bannedWords?: string[];
}

export interface DeliverOrderRequestShape {
  deliverableType: "schema";
  deliverableSchema: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid requirements: ${fieldName} must be a non-empty string.`);
  }
  return value.trim();
}

function parseStringArray(value: unknown, fieldName: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Invalid requirements: ${fieldName} must be an array of strings.`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function parsePlatform(value: unknown): Platform {
  const platform = assertString(value, "platform");
  if (platform !== "x_thread" && platform !== "linkedin_post" && platform !== "newsletter_blurb") {
    throw new Error(`Invalid requirements: platform must be one of x_thread, linkedin_post, or newsletter_blurb.`);
  }
  return platform;
}

export function parseRequirements(json: string): OrderRequirements {
  if (typeof json !== "string" || json.trim().length === 0) {
    throw new Error("Negotiation requirements must be a JSON string.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Negotiation requirements must be valid JSON: ${message}`);
  }

  if (!isPlainObject(parsed)) {
    throw new Error("Negotiation requirements must decode to a JSON object.");
  }

  return {
    sourceText: assertString(parsed.sourceText, "sourceText"),
    platform: parsePlatform(parsed.platform),
    requiredHashtags: parseStringArray(parsed.requiredHashtags, "requiredHashtags"),
    bannedWords: parseStringArray(parsed.bannedWords, "bannedWords"),
  };
}

export function fulfillOrder(requirements: OrderRequirements): DeliveryPayload {
  const content = generateContent(requirements.sourceText, requirements.platform, {
    requiredHashtags: requirements.requiredHashtags,
  });

  return {
    content,
    proof: buildProofBundle(content, {
      sourceText: requirements.sourceText,
      requiredHashtags: requirements.requiredHashtags,
      bannedWords: requirements.bannedWords,
    }),
  };
}

export function toDeliverOrderRequest(payload: DeliveryPayload): DeliverOrderRequestShape {
  return {
    deliverableType: "schema",
    deliverableSchema: JSON.stringify(payload),
  };
}