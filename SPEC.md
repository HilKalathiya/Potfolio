# hil.is-a.dev — Portfolio Spec (source of truth)
Owner: Hil Kalathiya · AI Engineer (Agentic AI, RAG, LangGraph) · B.Tech ICT, PDEU, 2027
Read ONLY the section a prompt references. Do not re-read this whole file every task.

## §1 Concept
The whole site is ONE agent run, played out on screen. Every section = one step of the run.
Rule: every visual must map to a real AI/ML mechanism an expert can name (trace, retrieval score,
tokenisation, UMAP, eval). If it doesn't, cut it. No particles, no 3D brain, no typewriter fluff.

## §2 Stack (decided — do not change without asking)
- Astro latest stable major (static-first) + React islands + TypeScript + Tailwind CSS v4 + `motion` (Framer Motion)
- Hand-built SVG for graphs (no React Flow, no three.js)
- Hosting: Cloudflare Pages (free). Server code: Cloudflare Pages Functions in `/functions`
- Storage: Cloudflare D1 (logs, counters, leaderboard). Bot protection: Cloudflare Turnstile
- Analytics: Cloudflare Web Analytics
- LLM cascade: Groq (Llama) → Cloudflare Workers AI → "sources only" mode. Never hard-fail.
- Retrieval: build-time embeddings (transformers.js, all-MiniLM-L6-v2) stored as JSON +
  in-browser BM25. Hybrid: BM25 always works; vector score added when query embedding available.
- Domain: hil-kalathiya.pages.dev now → hil.is-a.dev later (CNAME)
- Accounts allowed: GitHub, Cloudflare, Groq. NO other paid/free services.

## §3 Design tokens
- bg #0A0A0B · surface #121214 · border #232326 · text #EDEDED · muted #8A8A8F
- ONE accent: amber #FFB224 — used ONLY for "active node / live" state. Success #3DD68C, error #FF5F56 (status only)
- Fonts: Geist (UI), Geist Mono (traces, code, telemetry). Self-host via @fontsource.
- Radius 6px. 1px borders. No gradients, no glassmorphism, no glow except active node (subtle).
- Motion: 150–300ms, ease-out. All motion off under `prefers-reduced-motion`.
- Mobile: simplified vertical graph; 16px gutters; no horizontal scroll.

## §4 Persistent UI
- Left rail: agent-graph minimap = scroll navigation; current node amber.
- Bottom strip: telemetry `tokens · latency · runs today · cost/run` (real values from D1/static).
- ⌘K command palette: jump to sections, run agents, `/json` (page as structured data), `/trace`.
- `[ human view ]` toggle (top right): plain fast resume layout, same content. Remember choice (localStorage, try/catch).

## §5 Acts (sections)
- Act 0 Boot (≤2s): black, mono lines: `loading weights… mounting tools (N)… memory index: N chunks`
  (N from real data). Skip button after 1s. Returning visitors skip (localStorage).
- Act 1 First run (hero): auto query "Who is Hil Kalathiya?". Graph planner→retriever→tools→critic→answer
  lights in order. Retrieved chunks slide in with real similarity scores. Answer streams token-by-token.
  Hover answer → shows tokenisation (token boundaries + ids). Trace is PRE-RECORDED at build time from
  content (zero API cost). Must work offline.
- Act 2 Tools (skills): registered tool cards w/ JSON schema + "used in" project links. No % bars.
- Act 3 Runs (projects): replayable trace, architecture graph of real pipeline, "failures" log
  (what broke + fix), metrics only if real, else `eval: pending`. Ongoing projects: `status: running` + live commits.
- Act 4 Memory: 2D UMAP of real embeddings of all chunks (edu, certs, experience); hover = chunk.
- Act 4b Journey ("training log"): Hil's B.Tech journey (Jul 2023 → now) as a training run. X-axis = time
  (semesters), each milestone = a checkpoint `ckpt-YYYY-MM` with a one-line "what changed" (skill learned,
  project shipped, internship, competition). A thin skill-coverage curve rises across checkpoints (count of
  real skills/projects, not a fake loss). Click a checkpoint → its diff ("+ LangGraph, + RAG"). Current
  checkpoint pulses amber = "training still running". Source: `content/journey.json` — dates/events from
  resume, repo dates (repos.json created/pushed_at) and Hil's own input only. Missing dates → ask Hil.
- Act 5 Spawn agents: Mail agent, JD matcher (see §7). Orchestrator spawns sub-agent cards w/ own trace.
- Act 6 Return: `return { email, github, linkedin }` + summary of visitor's own session.

## §6 Projects (content order & honesty rules)
1. CrohnSight — Crohn-Disease-Early-Prediction (minor project, w/ Sahaj Saliya). Capsule-endoscopy,
   10× EfficientNet-B2 ensemble, ONNX. CrohnIPI AUROC 0.992, 96.7% acc (vs 94.6% published), QWK 0.94;
   external Kvasir AUROC 0.944, SEE-AI. Must show "Research prototype, not a medical device".
2. HospitalOps AI — status: running. Leakage-safe forecasting, walk-forward CV, ARIMA/SARIMAX/Prophet/LSTM,
   MAE 3.57 vs 6.22 naive, MLflow, MIP optimisation, idempotent ETL. Planned: LangGraph multi-agent + RAG.
3. MDT AI Copilot — HNNOIX internship (May–Jul 2026). LangGraph ReAct, 5 tools, Chroma + Cohere,
   guardrails (8-call cap, 4k truncation), z-score anomaly detector 80%+ recall, RSRP GBR forecast.
4. OpenEnv Data Cleaning — CO-BUILT with Chetan Gadhiya. Repo is a fork; live demo Space is Chetan's.
   Label clearly. README is the correct, latest source (HF router, Llama 3.1 8B, PPO agent); resume is outdated.
5. eCTD audit engine — Hil's own project (not client work). status: `design` (NOT a built system). Show as: system design for an auditable CMC
   drafting pipeline + ONE simulated stress test (OCR+VLM cross-check: 0 wrong values stored of 9,600, 194 routed
   to human). Must label "simulation". Never show external cited figures (Tufts, Weave Bio) as Hil's results.
   No internal phrases like "built with Claude". Facts from `_research/local/ectd.md` only.
6. Alfa Connectome ML challenge — EMBARGOED until 2026-11-16: competition rules forbid sharing code/strategy
   before Nov 15. Until then show ONLY: "Wunder Fund Alfa Connectome challenge — competing, results after
   Nov 15". No model, features, kernel, scores or leaderboard numbers anywhere (site, traces, JSON, embeddings).
Competitions (no repo): Amazon ML Challenge 2026 — participation line only, no claims of rank.
Secondary (small cards): Rajipo Transfer (Go + Pion WebRTC P2P), Hnnoix 5G Core GUI.
EXCLUDED — never show: misinformation_ai_hil, Vala-JAT, forks other than open-env-nuclei, register.
Never invent metrics. Source facts from `_research/` only.

## §7 Spawnable agents
- Mail agent: visitor intent → draft email → visitor edits → opens visitor's own mail client via `mailto:`
  prefilled to Hil. No email API. Suggests meeting times in body.
- JD matcher: paste JD → requirement-by-requirement fit, each match cites repo/project evidence, gaps stated plainly.
- Guardrails (all agents): Turnstile, D1 rate limit per IP-hash, max tokens, prompt-injection filter, visible in trace.

## §8 Mind-bending layer
- Re-planning: `?r=<company-role>` or first query → planner visibly reorders sections; trace explains why.
- Red-team mode: "Break my agent" — guardrail shows what it caught; D1 leaderboard; strict caps.
- Public evals: 30 golden Q&A about Hil, run nightly; show accuracy, groundedness, refusal rate.
- Maintenance log: shows nightly agent results (links checked, re-indexed, fixes).
- Agent-readable: `/llms.txt`, `/profile.json`, MCP endpoint at `/mcp` (read-only tools: get_profile, search_projects).

## §9 Auto-update & self-repair
- Single source of truth: `content/*.json` + `content/projects/*.md`.
- GitHub sync at build: repos, commits, stars (public API, cached; build must not fail if API fails).
- Nightly GitHub Action: sync → re-embed changed → link check → Lighthouse → Playwright screenshot diff → evals.
  On failure: open a PR with fix. NEVER auto-merge. LinkedIn is NOT synced (no API) — edit content JSON.

## §10 Tracking (privacy-respecting)
- `?r=` tracked links → D1 + optional Telegram ping. Log agent queries & pasted JDs (no IP stored, hash only).
- Footer notice: "This site logs queries to improve the agent." (DPDP Act).

## §11 Performance budget
- LCP < 2.5s on 4G, JS for first paint < 120KB gz. Lighthouse ≥ 90 all categories. Works without JS (human view).

## §12 Phases
1. Scaffold + tokens + layout shell + Act 0 + Act 1 (pre-recorded trace) + human-view toggle
2. Content extraction → content JSON; Acts 2–4; build-time embeddings + UMAP
3. Ask-my-agent (hybrid retrieval, LLM cascade), telemetry, D1
4. Spawnable agents + guardrails + red-team mode
5. Re-planning, evals, llms.txt, MCP, tracking, nightly Action, deploy, domain
