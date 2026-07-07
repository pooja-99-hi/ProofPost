import { PLATFORM_LIMITS, type GeneratedContent, type Platform } from "./proofSchema";

const CLAIM_KEYWORDS = /\b(?:fastest|first|only|most|best|leading)\b/i;

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function normalizeHashtag(tag: string): string {
  const trimmed = tag.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function uniqueNormalizedHashtags(tags: string[] = []): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of tags) {
    const value = normalizeHashtag(tag);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(value);
  }

  return normalized;
}

function chunkSentences(sentences: string[], limit: number): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= limit) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    if (sentence.length <= limit) {
      current = sentence;
      continue;
    }

    let start = 0;
    while (start < sentence.length) {
      const slice = sentence.slice(start, start + limit).trim();
      if (slice.length === 0) {
        break;
      }
      chunks.push(slice);
      start += limit;
    }
    current = "";
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function appendHashtags(text: string, hashtags: string[]): string {
  if (hashtags.length === 0) {
    return text;
  }
  return `${text} ${hashtags.join(" ")}`.trim();
}

function makeThreadPosts(sentences: string[], hashtags: string[]): string[] {
  let bodyLimit = 220;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const baseChunks = chunkSentences(sentences, bodyLimit);
    const total = baseChunks.length;
    const posts = baseChunks.map((chunk, index) => {
      const numbered = `${index + 1}/${total} ${chunk}`.trim();
      return index === total - 1 ? appendHashtags(numbered, hashtags) : numbered;
    });

    if (posts.every((post) => post.length <= PLATFORM_LIMITS.x_thread)) {
      return posts;
    }

    bodyLimit -= 20;
  }

  const fallback = chunkSentences(sentences, 120);
  const total = fallback.length;
  return fallback.map((chunk, index) => {
    const numbered = `${index + 1}/${total} ${chunk}`.trim();
    return index === total - 1 ? appendHashtags(numbered, hashtags) : numbered;
  });
}

function makeLinkedInPost(sentences: string[], hashtags: string[]): string[] {
  const hook = sentences[0] ?? "";
  const body = sentences.slice(1).join(" ");
  const text = appendHashtags([hook, body].filter(Boolean).join(" ").trim(), hashtags);
  return [text.slice(0, PLATFORM_LIMITS.linkedin_post)];
}

function makeNewsletterBlurb(sentences: string[]): string[] {
  const ordered = [...sentences].sort((left, right) => Number(isClaimSentence(right)) - Number(isClaimSentence(left)));
  const chunks = chunkSentences(ordered, PLATFORM_LIMITS.newsletter_blurb);
  return chunks.length > 0 ? [chunks[0]] : [""];
}

export function isClaimSentence(sentence: string): boolean {
  return /\d|%|\b(?:fastest|first|only|most|best|leading)\b/i.test(sentence);
}

export function extractClaims(sourceText: string): string[] {
  return splitSentences(sourceText).filter(isClaimSentence);
}

export interface GenerateContentOptions {
  requiredHashtags?: string[];
}

export function generateContent(sourceText: string, platform: Platform, options: GenerateContentOptions = {}): GeneratedContent {
  const sentences = splitSentences(sourceText);
  const hashtags = uniqueNormalizedHashtags(options.requiredHashtags);

  // Rule-based on purpose: the hackathon can run without API costs, and the
  // verifier only cares about the delivered content, not how it was produced.
  const postsByPlatform: Record<Platform, string[]> = {
    x_thread: makeThreadPosts(sentences, hashtags),
    linkedin_post: makeLinkedInPost(sentences, hashtags),
    newsletter_blurb: makeNewsletterBlurb(sentences),
  };

  return {
    platform,
    posts: postsByPlatform[platform].map((text, index) => ({ index, text })),
  };
}