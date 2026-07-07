import { createHash } from "crypto";

export type Platform = "x_thread" | "linkedin_post" | "newsletter_blurb";

export interface GeneratedPost {
  index: number;
  text: string;
}

export interface GeneratedContent {
  platform: Platform;
  posts: GeneratedPost[];
}

export interface LengthCheck {
  index: number;
  characterCount: number;
  limit: number;
  pass: boolean;
}

export interface HashtagCheck {
  required: string[];
  present: string[];
  pass: boolean;
}

export interface BannedWordsCheck {
  banned: string[];
  found: string[];
  pass: boolean;
}

export interface ClaimGrounding {
  claim: string;
  matchedSourceSpan: string | null;
  grounded: boolean;
}

export interface ProofBundle {
  platform: Platform;
  lengthChecks: LengthCheck[];
  hashtagCheck: HashtagCheck;
  bannedWordsCheck: BannedWordsCheck;
  claimGrounding: ClaimGrounding[];
  overallPass: boolean;
  generatedAt: string;
  resultHash: string;
}

export interface DeliveryPayload {
  content: GeneratedContent;
  proof: ProofBundle;
}

export interface ProofBundleWithoutHash {
  platform: Platform;
  lengthChecks: LengthCheck[];
  hashtagCheck: HashtagCheck;
  bannedWordsCheck: BannedWordsCheck;
  claimGrounding: ClaimGrounding[];
  overallPass: boolean;
  generatedAt: string;
}

export const PLATFORM_LIMITS: Record<Platform, number> = {
  x_thread: 280,
  linkedin_post: 3000,
  newsletter_blurb: 600,
};

export function computeResultHash(content: GeneratedContent, proofWithoutHash: ProofBundleWithoutHash): string {
  return createHash("sha256")
    .update(JSON.stringify({ content, proof: proofWithoutHash }))
    .digest("hex");
}