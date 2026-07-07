# ProofPost Backend Handoff for Frontend Work

This document is for the person building the frontend. The backend is already in place and validated locally. It is not an HTTP API server; it is a set of pure TypeScript proof functions plus two CAP/CROO scripts:

- `npm run provider` runs the real provider agent against CROO.
- `npm run requester` runs a separate buyer harness that negotiates, pays, and re-verifies delivery.

## What to install

Install these before doing any frontend integration work:

- Node.js 20 or newer.
- npm, which comes with Node.
- A code editor such as VS Code.
- A real CROO provider agent account and a second buyer agent account at agent.croo.network if you want to test the live order flow.

No extra global CLIs are required for the backend. The backend already uses the real `@croo-network/sdk` package from npm.

## Backend structure

The backend source of truth is in `backend/src`:

- `proofSchema.ts` defines the shared types, platform limits, and the result-hash function.
- `generate.ts` creates rule-based content from source text.
- `verify.ts` builds proof bundles and re-verifies delivered content.
- `orderHandler.ts` parses CROO negotiation requirements and turns them into a delivery payload.
- `config.ts` reads the CROO environment variables.
- `provider.ts` is the live provider agent that listens for CROO events and delivers content.
- `examples/requester.ts` is the buyer-side harness that checks the delivery independently.

## Exact backend setup

1. Open a terminal in `E:\projects\ProofPost\backend`.
2. Run `npm install`.
3. Create a `.env` file next to `.env.example` and fill in these values:
   - `CROO_API_URL`
   - `CROO_WS_URL`
   - `CROO_SDK_KEY`
   - `SERVICE_ID`
4. Use the values from your CROO dashboard at agent.croo.network.
5. For the requester harness, optionally set:
   - `REQUESTER_SOURCE_TEXT`
   - `REQUESTER_PLATFORM`
   - `REQUESTER_REQUIRED_HASHTAGS`
   - `REQUESTER_BANNED_WORDS`

If any required env var is missing, the backend throws a direct error naming the missing variable.

## How to verify the backend locally

Run these from `E:\projects\ProofPost\backend`:

1. `npm test`
2. `npm run build`

Both should pass before the frontend starts depending on the logic.

## How the frontend should integrate

The frontend should treat the backend proof logic as the contract, not as a black box service.

Recommended approach:

1. Mirror the pure logic from `backend/src/generate.ts` and `backend/src/verify.ts` into a browser-safe module.
2. Keep the frontend copy behaviorally aligned with the backend proof engine.
3. Use the same payload shape:
   - `GeneratedContent`
   - `ProofBundle`
   - `DeliveryPayload`
4. When the user clicks Generate or Verify in the UI, the frontend should build the same content and proof structure that the backend would build.
5. If you later want one shared source of truth, move the pure modules into a shared package, but that is optional for the hackathon.

Important: there is no backend HTTP endpoint yet. Do not build the frontend assuming `/api/generate` or `/api/verify` exists.

## Live CROO test flow

If you want to confirm the full provider/requester loop on Base mainnet, follow this order:

1. Register the provider agent in the CROO dashboard.
2. Configure a service that uses Schema requirements and a Schema deliverable.
3. Copy the provider agent SDK key into `CROO_SDK_KEY`.
4. Start the provider with `npm run provider`.
5. Register a second buyer agent.
6. Fund the buyer agent with a small amount of USDC in its AA wallet.
7. Set the buyer agent key in the requester environment and run `npm run requester`.
8. Confirm the order moves through negotiate, create, pay, deliver, and complete.

This is on Base mainnet. There is no separate CAP testnet.

## Runtime behavior to expect

The provider does this:

- On `NegotiationCreated`, it accepts the negotiation.
- On `OrderPaid`, it loads the negotiation requirements, generates content, builds the proof bundle, and delivers the payload as a Schema deliverable.
- If fulfillment fails, it rejects the order with the error message instead of leaving it hanging.

The requester does this:

- It negotiates an order with JSON requirements.
- When the order is created, it pays it.
- When the order completes, it fetches the delivery and re-runs verification locally.
- It prints `MATCH` or `MISMATCH` based on the recomputed proof.

## Frontend implementation notes

- The demo UI should use the same platform names as the backend: `x_thread`, `linkedin_post`, `newsletter_blurb`.
- The proof bundle should show length checks, hashtag checks, banned-word checks, and claim grounding.
- A fabricated claim should visibly fail claim grounding when the source text does not support the altered number.
- Keep the UI client-side so the demo still works even if the network is unavailable.

## Common mistakes to avoid

- Do not invent new CROO SDK method names. The backend uses the real installed SDK declarations from `@croo-network/sdk@0.2.1`.
- Do not assume the backend is a REST service.
- Do not change the proof shape in the frontend unless the backend types change too.
- Do not treat the heuristic verifier as perfect fact-checking. It is intentionally narrow and explicit.

## Quick command list

From `E:\projects\ProofPost\backend`:

1. `npm install`
2. `npm test`
3. `npm run build`
4. `npm run provider`
5. `npm run requester`

If the frontend developer needs a starting point, they should build the UI around the proof types in `backend/src/proofSchema.ts` and the verifier contract in `backend/src/verify.ts`.