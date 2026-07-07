import { describe, expect, it } from "vitest";
import { generateContent } from "../src/generate";
import { fulfillOrder, parseRequirements } from "../src/orderHandler";
import { computeResultHash } from "../src/proofSchema";
import { buildProofBundle, reverifyDelivery } from "../src/verify";

describe("ProofPost verification", () => {
  const sourceText =
    "ProofPost reduced review time by 38% in a four-week pilot. It was the first workflow to ground every factual claim in source text. The team reached the fastest turnaround among its beta users.";

  it("grounds honest claims and computes a stable hash", () => {
    const content = generateContent(sourceText, "linkedin_post", { requiredHashtags: ["#ProofPost"] });
    const proof = buildProofBundle(content, {
      sourceText,
      requiredHashtags: ["#ProofPost"],
      bannedWords: ["guaranteed"],
    });
    const { resultHash, ...proofWithoutHash } = proof;

    expect(proof.overallPass).toBe(true);
    expect(proof.claimGrounding.every((claim) => claim.grounded)).toBe(true);
    expect(resultHash).toBe(computeResultHash(content, proofWithoutHash));
  });

  it("catches a fabricated stat", () => {
    const payload = fulfillOrder({
      sourceText,
      platform: "x_thread",
      requiredHashtags: ["#ProofPost"],
      bannedWords: ["guaranteed"],
    });

    const fabricatedContent = {
      ...payload.content,
      posts: payload.content.posts.map((post) => ({ ...post })),
    };

    const firstWithNumber = fabricatedContent.posts.find((post) => /\d/.test(post.text));
    if (firstWithNumber) {
      firstWithNumber.text = firstWithNumber.text.replace(/\b(\d+(?:\.\d+)?)\b/, (value) => String(Number(value) * 2.2));
    }

    const badVerification = buildProofBundle(fabricatedContent, {
      sourceText,
      requiredHashtags: ["#ProofPost"],
      bannedWords: ["guaranteed"],
    });

    expect(badVerification.overallPass).toBe(false);
    expect(badVerification.claimGrounding.some((claim) => !claim.grounded)).toBe(true);
    expect(reverifyDelivery({ content: fabricatedContent, proof: payload.proof }, {
      sourceText,
      requiredHashtags: ["#ProofPost"],
      bannedWords: ["guaranteed"],
    }).overallPass).toBe(false);
  });

  it("parses negotiation requirements", () => {
    const requirements = parseRequirements(
      JSON.stringify({
        sourceText,
        platform: "newsletter_blurb",
        requiredHashtags: ["#ProofPost"],
        bannedWords: ["always"],
      }),
    );

    expect(requirements.platform).toBe("newsletter_blurb");
    expect(requirements.requiredHashtags).toEqual(["#ProofPost"]);
  });
});