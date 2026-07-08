import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  generateAndVerify,
  getOrderHistory,
  checkBackendStatus,
  GROUND_THRESHOLD,
  X_LIMIT,
  NEWSLETTER_LIMIT,
  type Delivery,
  type Platform,
  type ProofBundle,
} from "@/lib/proofpostApi";

export const Route = createFileRoute("/")({
  component: Index,
});

const SAMPLE_SOURCE = `In our Q3 2025 developer survey of 1,200 respondents, 40% said they now trust AI-generated marketing copy less than they did a year ago. Only 12% said their team runs a formal fact-check on every AI post. Meanwhile, brand mentions on X grew 18% quarter over quarter, making it the fastest-growing distribution channel for early-stage startups. The report is the first industry study to correlate content trust scores with on-chain attestation adoption.`;

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      
      <Hero />
      <HowFlow />
      <Playground />
      <FabricationDemo />
      <OnChainSection />
      <HowItWorks />
      <Footer />
    </div>
  );
}


function Logo() {
  return (
    <div className="grid h-7 w-7 place-items-center rounded-md border border-primary/40 bg-primary/10 text-primary">
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
        <path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div className="grid-bg absolute inset-0 opacity-40" />
      <div className="absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mono inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--pass)] animate-pulse" />
            CAP · Content Attestation Protocol on Base
          </div>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight md:text-7xl">
            No proof,{" "}
            <span className="bg-gradient-to-r from-[var(--brand)] to-[var(--brand-glow)] bg-clip-text text-transparent">
              no payment.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            ProofPost extends CAP's proof-based trust model to subjective content generation.
            Every AI post ships with a machine-checkable bundle proving factual claims are
            grounded in real source text — not hallucinated.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
              href="#playground"
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90"
            >
              Open playground →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowFlow() {
  const steps = [
    { title: "Source text", desc: "Article, report, or press release", tone: "muted" as const },
    { title: "Generated post", desc: "X / LinkedIn / Newsletter", tone: "brand" as const },
    { title: "Proof bundle", desc: "Pass / fail — verifiable", tone: "pass" as const },
  ];
  return (
    <section className="border-b border-border/60 bg-card/30">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-6 py-12 md:grid-cols-3">
        {steps.map((s, i) => (
          <div key={s.title} className="flex items-center gap-4">
            <div
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-md border font-mono text-sm ${
                s.tone === "brand"
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : s.tone === "pass"
                    ? "border-[var(--pass)]/50 bg-[var(--pass)]/10 text-[var(--pass)]"
                    : "border-border bg-muted text-muted-foreground"
              }`}
            >
              0{i + 1}
            </div>
            <div>
              <div className="text-sm font-medium">{s.title}</div>
              <div className="text-xs text-muted-foreground">{s.desc}</div>
            </div>
            {i < steps.length - 1 && (
              <div className="ml-auto hidden text-muted-foreground md:block">→</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- Playground ----------

function Playground() {
  const [source, setSource] = useState(SAMPLE_SOURCE);
  const [platform, setPlatform] = useState<Platform>("x_thread");
  const [hashtags, setHashtags] = useState<string[]>(["#trust", "#ai"]);
  const [banned, setBanned] = useState<string[]>(["revolutionary"]);
  const [loading, setLoading] = useState(false);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  
  const [isBackendOnline, setIsBackendOnline] = useState(false);
  const [mode, setMode] = useState<"mock" | "local" | "croo">("mock");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Check backend server status
  useEffect(() => {
    let active = true;
    async function check() {
      const online = await checkBackendStatus();
      if (!active) return;
      setIsBackendOnline(online);
      setMode((current) => {
        if (online && current === "mock") return "local";
        if (!online && current !== "mock") return "mock";
        return current;
      });
    }
    check();
    const interval = setInterval(check, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  async function onGenerate() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const d = await generateAndVerify({
        sourceText: source,
        platform,
        requiredHashtags: hashtags,
        bannedWords: banned,
      }, { mode });
      setDelivery(d);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An unexpected error occurred during execution.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="playground" className="border-b border-border/60">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeader
          eyebrow="Playground"
          title="Generate & verify"
          desc="Paste source text, pick a platform, ship a post — with a proof bundle attached."
        />

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Inputs */}
          <div className="rounded-lg border border-border bg-card p-5">
            <Label>Source text</Label>
            <textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              rows={9}
              className="mt-2 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
              placeholder="Paste an article, report, or press release..."
            />

            <div className="mt-5">
              <Label>Platform</Label>
              <SegmentedControl<Platform>
                value={platform}
                onChange={setPlatform}
                options={[
                  { value: "x_thread", label: "X Thread" },
                  { value: "linkedin_post", label: "LinkedIn" },
                  { value: "newsletter_blurb", label: "Newsletter" },
                ]}
              />
            </div>

            <div className="mt-5">
              <Label>Execution Mode</Label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("mock")}
                  className={`rounded-md border px-3 py-2 text-xs font-medium transition text-center ${
                    mode === "mock"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Mock (Client)
                </button>
                <button
                  type="button"
                  disabled={!isBackendOnline}
                  onClick={() => setMode("local")}
                  className={`rounded-md border px-3 py-2 text-xs font-medium transition text-center ${
                    mode === "local"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
                  }`}
                  title={!isBackendOnline ? "Start backend server to enable local mode" : "Direct execution on backend server"}
                >
                  Local (API)
                </button>
                <button
                  type="button"
                  disabled={!isBackendOnline}
                  onClick={() => setMode("croo")}
                  className={`rounded-md border px-3 py-2 text-xs font-medium transition text-center ${
                    mode === "croo"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
                  }`}
                  title={!isBackendOnline ? "Start backend server to enable CROO mode" : "Real attested CROO transaction lifecycle"}
                >
                  CROO (Web3)
                </button>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">
                  {mode === "mock" && "Runs verification instantly inside the browser."}
                  {mode === "local" && "Generates and signs locally via backend HTTP API."}
                  {mode === "croo" && "Sends to CROO contracts / WebSocket flow (requires env keys)."}
                </span>
                <span className={`inline-flex items-center gap-1 font-mono ${isBackendOnline ? "text-[var(--pass)]" : "text-muted-foreground"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isBackendOnline ? "bg-[var(--pass)] animate-pulse" : "bg-neutral-600"}`} />
                  backend {isBackendOnline ? "online" : "offline"}
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <TagInput label="Required hashtags" tags={hashtags} setTags={setHashtags} placeholder="Add hashtag" tone="brand" />
              <TagInput label="Banned words" tags={banned} setTags={setBanned} placeholder="Add banned word" tone="fail" />
            </div>

            {errorMsg && (
              <div className="mt-4 rounded-md border border-[var(--fail)]/30 bg-[var(--fail)]/5 p-3 text-xs text-[var(--fail)]">
                <div className="font-semibold uppercase tracking-wider text-[10px] mb-1">Execution Error</div>
                <p className="leading-relaxed">{errorMsg}</p>
                {mode === "croo" && (
                  <p className="mt-1 text-muted-foreground">
                    Tip: Ensure you have set valid Base credentials in `backend/.env` and your agent service is registered and funded.
                  </p>
                )}
              </div>
            )}

            <button
              onClick={onGenerate}
              disabled={loading || !source.trim()}
              className="mt-6 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-50 animate-glow-ring"
            >
              {loading ? "Executing order lifecycle..." : "Generate & Verify"}
            </button>
          </div>

          {/* Output */}
          <div className="space-y-6">
            {delivery ? (
              <>
                <PostOutput delivery={delivery} />
                <ProofPanel proof={delivery.proof} />
              </>
            ) : (
              <div className="grid h-full min-h-[400px] place-items-center rounded-lg border border-dashed border-border bg-card/40 p-10 text-center">
                <div>
                  <div className="mono text-xs text-muted-foreground">awaiting_input</div>
                  <div className="mt-3 text-lg font-medium">No proof bundle yet</div>
                  <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                    Generate a post to see the formatted output and its cryptographic proof bundle appear here.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <div className="max-w-2xl">
      <div className="mono text-xs uppercase tracking-widest text-primary">{eyebrow}</div>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
      <p className="mt-3 text-sm text-muted-foreground md:text-base">{desc}</p>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div className="mono text-[11px] uppercase tracking-wider text-muted-foreground">{children}</div>;
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="mt-2 inline-flex rounded-md border border-border bg-background p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded px-3 py-1.5 text-xs font-medium transition ${
            value === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TagInput({
  label,
  tags,
  setTags,
  placeholder,
  tone,
}: {
  label: string;
  tags: string[];
  setTags: (t: string[]) => void;
  placeholder: string;
  tone: "brand" | "fail";
}) {
  const [val, setVal] = useState("");
  function add() {
    const v = val.trim();
    if (!v) return;
    if (tags.includes(v)) return setVal("");
    setTags([...tags, v]);
    setVal("");
  }
  const chipCls =
    tone === "brand"
      ? "border-primary/40 bg-primary/10 text-primary"
      : "border-[var(--fail)]/40 bg-[var(--fail)]/10 text-[var(--fail)]";
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-2 flex flex-wrap gap-1.5 rounded-md border border-border bg-background p-2">
        {tags.map((t) => (
          <span key={t} className={`mono inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs ${chipCls}`}>
            {t}
            <button
              onClick={() => setTags(tags.filter((x) => x !== t))}
              className="text-current opacity-60 hover:opacity-100"
              aria-label="remove"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder={placeholder}
          className="flex-1 min-w-[100px] bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}

function PostOutput({ delivery }: { delivery: Delivery }) {
  const { platform, content } = delivery;
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <Label>Generated post · {platformLabel(platform)}</Label>
        <span className="mono text-[10px] text-muted-foreground">order {delivery.orderId}</span>
      </div>
      <div className="mt-4">
        {platform === "x_thread" && <XThreadView content={content} />}
        {platform === "linkedin_post" && <LinkedInView content={content} />}
        {platform === "newsletter_blurb" && <NewsletterView content={content} />}
      </div>
    </div>
  );
}

function platformLabel(p: Platform) {
  return p === "x_thread" ? "X Thread" : p === "linkedin_post" ? "LinkedIn Post" : "Newsletter Blurb";
}

function XThreadView({ content }: { content: string }) {
  const tweets = content.split(/\n---\n/);
  return (
    <div className="space-y-3">
      {tweets.map((t, i) => {
        const over = t.length > X_LIMIT;
        return (
          <div key={i} className="rounded-md border border-border bg-background p-4">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{t}</div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="mono text-muted-foreground">tweet {i + 1}/{tweets.length}</span>
              <span className={`mono ${over ? "text-[var(--fail)]" : "text-muted-foreground"}`}>
                {t.length}/{X_LIMIT}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LinkedInView({ content }: { content: string }) {
  const parts = content.split(/\*\*(.+?)\*\*/);
  return (
    <div className="rounded-md border border-border bg-background p-4 text-sm leading-relaxed">
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="text-foreground">{p}</strong>
        ) : (
          <span key={i} className="whitespace-pre-wrap text-foreground/90">{p}</span>
        ),
      )}
    </div>
  );
}

function NewsletterView({ content }: { content: string }) {
  const over = content.length > NEWSLETTER_LIMIT;
  return (
    <div className="rounded-md border border-border bg-background p-4">
      <div className="text-sm leading-relaxed text-foreground/90">{content}</div>
      <div className="mt-2 flex justify-end text-[11px]">
        <span className={`mono ${over ? "text-[var(--fail)]" : "text-muted-foreground"}`}>
          {content.length}/{NEWSLETTER_LIMIT}
        </span>
      </div>
    </div>
  );
}

// ---------- Proof panel ----------

function ProofPanel({ proof }: { proof: ProofBundle }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div
      key={proof.resultHash}
      className={`animate-proof-pulse rounded-lg border p-5 ${
        proof.overallPass ? "border-[var(--pass)]/40 bg-[var(--pass)]/5" : "border-[var(--fail)]/40 bg-[var(--fail)]/5"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusBadge pass={proof.overallPass} />
          <div>
            <div className="text-sm font-semibold">
              {proof.overallPass ? "Proof bundle: PASS" : "Proof bundle: FAIL"}
            </div>
            <div className="mono text-[11px] text-muted-foreground">
              {proof.claims.length} claim{proof.claims.length === 1 ? "" : "s"} analyzed
            </div>
          </div>
        </div>
        <HashDisplay hash={proof.resultHash} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <CheckRow ok={proof.lengthOk} label="Length limit respected" />
        <CheckRow ok={proof.hashtagsOk} label="Required hashtags present" />
        <CheckRow ok={proof.bannedWordsOk} label="No banned words" />
        <CheckRow ok={proof.allClaimsGrounded} label="All claims grounded" />
      </div>

      {proof.claims.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="mono flex w-full items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <span>Claims ({proof.claims.length})</span>
            <span>{expanded ? "−" : "+"}</span>
          </button>
          {expanded && (
            <div className="mt-3 space-y-3">
              {proof.claims.map((c, i) => (
                <ClaimRow key={i} claim={c} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ pass }: { pass: boolean }) {
  return (
    <div
      className={`grid h-10 w-10 place-items-center rounded-full ${
        pass ? "bg-[var(--pass)]/15 text-[var(--pass)]" : "bg-[var(--fail)]/15 text-[var(--fail)]"
      }`}
    >
      {pass ? (
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
          <path d="M5 12l5 5 9-11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-draw-check" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-2 text-sm">
      <span className={ok ? "text-[var(--pass)]" : "text-[var(--fail)]"}>
        {ok ? "✓" : "✕"}
      </span>
      <span className="text-foreground/90">{label}</span>
    </div>
  );
}

function ClaimRow({ claim }: { claim: import("@/lib/proofpostApi").Claim }) {
  const pct = Math.round(claim.overlapScore * 100);
  const threshPct = Math.round(GROUND_THRESHOLD * 100);
  return (
    <div className="rounded-md border border-border bg-background/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm leading-snug text-foreground/90">"{claim.claimSentence}"</div>
        <span
          className={`mono shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${
            claim.grounded
              ? "border-[var(--pass)]/40 bg-[var(--pass)]/10 text-[var(--pass)]"
              : "border-[var(--fail)]/40 bg-[var(--fail)]/10 text-[var(--fail)]"
          }`}
        >
          {claim.grounded ? "grounded" : "ungrounded"}
        </span>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="mono text-muted-foreground">overlapScore</span>
          <span className="mono text-foreground">{pct}% <span className="text-muted-foreground">/ ≥{threshPct}%</span></span>
        </div>
        <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full ${claim.overlapScore >= GROUND_THRESHOLD ? "bg-[var(--pass)]" : "bg-[var(--fail)]"}`}
            style={{ width: `${Math.max(4, pct)}%` }}
          />
          <div
            className="absolute inset-y-0 w-px bg-foreground/40"
            style={{ left: `${threshPct}%` }}
            title={`threshold ${threshPct}%`}
          />
        </div>
      </div>

      <div className="mt-3 text-xs">
        <div className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Matched source</div>
        <div className="mt-1 text-foreground/80">
          {claim.matchedSourceSentence ?? <span className="text-[var(--fail)]">no match found</span>}
        </div>
      </div>

      {claim.numbersInClaim.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded border border-border bg-card/60 px-2 py-1.5">
            <div className="mono text-[10px] uppercase tracking-wider text-muted-foreground">In claim</div>
            <div className="mono mt-0.5">{claim.numbersInClaim.join(", ")}</div>
          </div>
          <div className="rounded border border-border bg-card/60 px-2 py-1.5">
            <div className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Matched in source</div>
            <div className={`mono mt-0.5 ${claim.numbersMatchedInSource ? "text-[var(--pass)]" : "text-[var(--fail)]"}`}>
              {claim.numbersMatchedInSource ? "yes ✓" : "no ✕"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HashDisplay({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);
  const truncated = `${hash.slice(0, 8)}…${hash.slice(-6)}`;
  async function copy() {
    await navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }
  return (
    <button
      onClick={copy}
      title={hash}
      className="mono flex items-center gap-1.5 rounded border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
    >
      <span className="hidden sm:inline">sha256:</span>
      <span className="text-foreground">{truncated}</span>
      <span className="text-muted-foreground">{copied ? "✓" : "⧉"}</span>
    </button>
  );
}

// ---------- Fabrication demo ----------

const FAB_SOURCE = `In our Q3 developer survey, 40% of respondents said they distrust AI-generated marketing copy more than a year ago. The sample size was 1,200 developers across 30 countries.`;

function FabricationDemo() {
  const [mode, setMode] = useState<"honest" | "fabricated">("honest");
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [isBackendOnline, setIsBackendOnline] = useState(false);

  useEffect(() => {
    checkBackendStatus().then(setIsBackendOnline);
  }, []);

  useEffect(() => {
    let cancel = false;
    generateAndVerify(
      { sourceText: FAB_SOURCE, platform: "linkedin_post", requiredHashtags: [], bannedWords: [] },
      { 
        fabricate: mode === "fabricated",
        mode: isBackendOnline ? "local" : "mock"
      },
    ).then((d) => {
      if (!cancel) setDelivery(d);
    });
    return () => {
      cancel = true;
    };
  }, [mode, isBackendOnline]);

  return (
    <section id="fabrication" className="border-b border-border/60 bg-card/20">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeader
          eyebrow="The wow moment"
          title="Catch fabrication automatically"
          desc="Same source text, two generations. Flip the toggle — the proof engine catches the fabricated number instantly."
        />

        <div className="mt-8 inline-flex rounded-md border border-border bg-background p-1">
          <button
            onClick={() => setMode("honest")}
            className={`rounded px-4 py-2 text-xs font-medium transition ${
              mode === "honest" ? "bg-[var(--pass)]/20 text-[var(--pass)]" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            A · Honest generation
          </button>
          <button
            onClick={() => setMode("fabricated")}
            className={`rounded px-4 py-2 text-xs font-medium transition ${
              mode === "fabricated" ? "bg-[var(--fail)]/20 text-[var(--fail)]" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            B · Fabricated generation
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-5">
            <Label>Source text (unchanged)</Label>
            <p className="mt-3 text-sm leading-relaxed text-foreground/85">{FAB_SOURCE}</p>
          </div>

          {delivery && (
            <div className="space-y-6">
              <PostOutput delivery={delivery} />
              <ProofPanel proof={delivery.proof} />
            </div>
          )}
        </div>

        <p className="mono mt-6 text-center text-xs text-muted-foreground">
          The proof engine catches fabricated numbers automatically — no human fact-check required.
        </p>
      </div>
    </section>
  );
}

// ---------- On-chain section ----------

function OnChainSection() {
  const [history, setHistory] = useState<Delivery[]>([]);
  useEffect(() => {
    getOrderHistory().then(setHistory);
  }, []);
  const sample = history[0];

  return (
    <section id="onchain" className="border-b border-border/60">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeader
          eyebrow="On-chain"
          title="Every order settles on Base"
          desc="Payment and delivery are real on-chain transactions on Base — verifiable on Basescan."
        />

        {sample && (
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            <TxField label="Payment tx" hash={sample.paymentTx!} />
            <TxField label="Delivery tx" hash={sample.deliveryTx!} />
          </div>
        )}

        <div className="mt-8 overflow-hidden rounded-lg border border-border bg-card">
          <div className="mono border-b border-border bg-background/40 px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            Order history
          </div>
          {history.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No orders yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left font-normal">Order</th>
                  <th className="px-4 py-2 text-left font-normal">Platform</th>
                  <th className="px-4 py-2 text-left font-normal">Result</th>
                  <th className="px-4 py-2 text-left font-normal">Timestamp</th>
                  <th className="px-4 py-2 text-left font-normal">Tx</th>
                </tr>
              </thead>
              <tbody>
                {history.map((d) => (
                  <tr key={d.orderId} className="border-b border-border/60 last:border-0">
                    <td className="mono px-4 py-3 text-foreground">{d.orderId}</td>
                    <td className="px-4 py-3 text-muted-foreground">{platformLabel(d.platform)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`mono rounded border px-1.5 py-0.5 text-[10px] ${
                          d.proof.overallPass
                            ? "border-[var(--pass)]/40 bg-[var(--pass)]/10 text-[var(--pass)]"
                            : "border-[var(--fail)]/40 bg-[var(--fail)]/10 text-[var(--fail)]"
                        }`}
                      >
                        {d.proof.overallPass ? "PASS" : "FAIL"}
                      </span>
                    </td>
                    <td className="mono px-4 py-3 text-muted-foreground text-xs">
                      {new Date(d.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`https://basescan.org/tx/${d.deliveryTx}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mono text-xs text-primary hover:underline"
                      >
                        {d.deliveryTx!.slice(0, 10)}… ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}

function TxField({ label, hash }: { label: string; hash: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <Label>{label}</Label>
      <div className="mono mt-2 flex items-center justify-between gap-3">
        <span className="truncate text-xs text-foreground">{hash}</span>
        <a
          href={`https://basescan.org/tx/${hash}`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded border border-border bg-background px-2 py-1 text-[11px] text-primary hover:border-primary/50"
        >
          View on Basescan ↗
        </a>
      </div>
    </div>
  );
}

// ---------- How it works ----------

function HowItWorks() {
  const steps = useMemo(
    () => [
      { fn: "negotiateOrder()", title: "Negotiate", desc: "Requester and provider agree on scope, requirements, and price." },
      { fn: "payOrder()", title: "Pay", desc: "Requester pays into escrow on Base." },
      { fn: "deliverOrder()", title: "Deliver", desc: "Provider generates content, builds proof bundle, and delivers on-chain." },
      { fn: "getDelivery() → recompute", title: "Verify locally", desc: "Requester re-runs the proof check and confirms resultHash MATCHES." },
    ],
    [],
  );

  return (
    <section id="how" className="border-b border-border/60 bg-card/20">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeader
          eyebrow="How it works"
          title="Four calls. Full trust."
          desc="ProofPost mirrors CAP's proof-based order flow — every step is verifiable end-to-end."
        />
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.title} className="relative rounded-lg border border-border bg-card p-5">
              <div className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                step {i + 1}
              </div>
              <div className="mt-2 text-base font-semibold">{s.title}</div>
              <div className="mono mt-2 inline-block rounded border border-border bg-background px-2 py-0.5 text-[11px] text-primary">
                {s.fn}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-6 py-10 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-sm font-semibold">ProofPost</span>
          <span className="mono ml-2 text-[10px] text-muted-foreground">v0.1 · demo</span>
        </div>
        <div className="mono text-[11px] text-muted-foreground">
          Powered by CROO Network · CAP on Base
        </div>
      </div>
    </footer>
  );
}
