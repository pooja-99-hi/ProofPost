import {
  PLATFORM_LIMITS,
  computeResultHash,
  type BannedWordsCheck,
  type ClaimGrounding,
  type DeliveryPayload,
  type GeneratedContent,
  type HashtagCheck,
  type LengthCheck,
  type Platform,
  type ProofBundle,
  type ProofBundleWithoutHash,
} from "./proofSchema";
import { extractClaims, isClaimSentence } from "./generate";

export interface VerificationOptions {
  sourceText: string;
  requiredHashtags?: string[];
  bannedWords?: string[];
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeTag(tag: string): string {
  const trimmed = tag.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

function stripPresentationNoise(text: string): string {
  return text.replace(/^\s*\d+\/\d+\s+/, "").replace(/^\s*\d+\.\s+/, "").trim();
}

function extractNumbers(text: string): string[] {
  const matches = text.match(/\b\d+(?:\.\d+)?%?\b/g) ?? [];
  return matches.map((value) => value.toLowerCase());
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "were",
  "with",
]);

function wordsForOverlap(text: string): string[] {
  return normalizeWhitespace(text)
    .toLowerCase()
    .match(/[a-z0-9%]+/g)
    ?.filter((word) => word.length > 2 && !STOP_WORDS.has(word)) ?? [];
}

function overlapScore(left: string, right: string): number {
  const leftWords = new Set(wordsForOverlap(left));
  const rightWords = new Set(wordsForOverlap(right));

  if (leftWords.size === 0 || rightWords.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const word of leftWords) {
    if (rightWords.has(word)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(leftWords.size, rightWords.size);
}

function findBestSourceSpan(claim: string, sourceSentences: string[]): string | null {
  const claimNumbers = extractNumbers(claim);
  let bestSpan: string | null = null;
  let bestScore = 0;

  for (const sourceSentence of sourceSentences) {
    const sourceNumbers = new Set(extractNumbers(sourceSentence));
    if (claimNumbers.length > 0 && claimNumbers.some((number) => !sourceNumbers.has(number))) {
      continue;
    }

    const score = overlapScore(claim, sourceSentence);
    if (score > bestScore) {
      bestScore = score;
      bestSpan = sourceSentence;
    }
  }

  return bestScore >= 0.35 ? bestSpan : null;
}

function collectClaimGrounding(content: GeneratedContent, sourceText: string): ClaimGrounding[] {
  const sourceSentences = splitSentences(sourceText);
  const claims: string[] = [];

  for (const post of content.posts) {
    for (const sentence of splitSentences(stripPresentationNoise(post.text))) {
      if (isClaimSentence(sentence)) {
        claims.push(sentence);
      }
    }
  }

  return claims.map((claim) => {
    const matchedSourceSpan = findBestSourceSpan(claim, sourceSentences);
    return {
      claim,
      matchedSourceSpan,
      grounded: matchedSourceSpan !== null,
    };
  });
}

function buildLengthChecks(content: GeneratedContent, platform: Platform): LengthCheck[] {
  const limit = PLATFORM_LIMITS[platform];
  return content.posts.map((post) => ({
    index: post.index,
    characterCount: post.text.length,
    limit,
    pass: post.text.length <= limit,
  }));
}

function buildHashtagCheck(content: GeneratedContent, requiredHashtags: string[] = []): HashtagCheck {
  const required = requiredHashtags.map(normalizeTag).filter(Boolean);
  const combined = normalizeWhitespace(content.posts.map((post) => post.text).join(" ")).toLowerCase();
  const present = required.filter((tag) => combined.includes(tag.toLowerCase()));
  return {
    required,
    present,
    pass: present.length === required.length,
  };
}

function buildBannedWordsCheck(content: GeneratedContent, bannedWords: string[] = []): BannedWordsCheck {
  const normalizedBanned = bannedWords.map(normalizeWord).filter(Boolean);
  const combined = normalizeWhitespace(content.posts.map((post) => post.text).join(" ")).toLowerCase();
  const found = normalizedBanned.filter((word) => combined.includes(word));
  return {
    banned: normalizedBanned,
    found,
    pass: found.length === 0,
  };
}

export function buildProofBundle(content: GeneratedContent, options: VerificationOptions): ProofBundle {
  const lengthChecks = buildLengthChecks(content, content.platform);
  const hashtagCheck = buildHashtagCheck(content, options.requiredHashtags);
  const bannedWordsCheck = buildBannedWordsCheck(content, options.bannedWords);
  const claimGrounding = collectClaimGrounding(content, options.sourceText);
  const overallPass =
    lengthChecks.every((check) => check.pass) &&
    hashtagCheck.pass &&
    bannedWordsCheck.pass &&
    claimGrounding.every((claim) => claim.grounded);

  const proofWithoutHash: ProofBundleWithoutHash = {
    platform: content.platform,
    lengthChecks,
    hashtagCheck,
    bannedWordsCheck,
    claimGrounding,
    overallPass,
    generatedAt: new Date().toISOString(),
  };

  return {
    ...proofWithoutHash,
    resultHash: computeResultHash(content, proofWithoutHash),
  };
}

export function reverifyDelivery(payload: DeliveryPayload, options: VerificationOptions): ProofBundle {
  return buildProofBundle(payload.content, options);
}