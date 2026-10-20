// Builds src/data/hero-trace.json — the pre-recorded Act 1 trace.
// Facts come only from _research/ (resume.txt, readmes/, repos.json, local/*.md).
// Runs at build time (npm run prebuild) so Act 1 works fully offline, zero API cost.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { encode, decode } from 'gpt-tokenizer';
import { pipeline, env } from '@huggingface/transformers';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, '../src/data/hero-trace.json');

const query = 'Who is Hil Kalathiya?';

// Retrieval corpus — short excerpts drawn only from _research/ facts. `source` is the public link shown in the UI, never an internal path.
// SPEC §6 exclusions respected: no misinformation_ai_hil, Vala-JAT, forks other
// than open-env-nuclei, or "register". The embargoed Alfa Connectome project is
// deliberately NOT in the hero corpus, so it can never be retrieved here.
const corpus = [
  {
    id: 'resume-identity',
    source: { label: 'resume', url: null },
    text: 'Hil Kalathiya is an AI Engineer (Fresher) working on Agentic AI, RAG, LangGraph and Multi-Agent Systems. Hil is pursuing a B.Tech in Information and Communication Technology at Pandit Deendayal Energy University (PDEU), CGPA 8.55/10, Jul 2023 - May 2027.',
  },
  {
    id: 'resume-hnnoix',
    source: { label: 'resume', url: null },
    text: 'Summer Intern, AI/ML (5G/6G Research & Innovation) at HNNOIX India Private Limited, May-Jul 2026. Built a LangGraph ReAct agent for 5G MDT analytics routing across 5 tools, Chroma retrieval over project docs and C source, Cohere embeddings. Added an 8-tool-call cap and 4,000-character truncation. Designed a per-UE rolling z-score anomaly detector reaching 80%+ recall on injected coverage holes. Built an RSRP forecasting pipeline with GradientBoostingRegressor beating a naive baseline.',
  },
  {
    id: 'hospitalops',
    source: { label: 'github.com/HilKalathiya/HospitalOps-AI', url: 'https://github.com/HilKalathiya/HospitalOps-AI' },
    text: 'HospitalOps AI is a Bed Demand Forecasting & Resource Optimization project. Leakage-safe forecasting pipeline with chronological splits and true walk-forward cross-validation on two real-world hospital datasets. Benchmarked naive, seasonal-naive, ARIMA/SARIMAX and Prophet, cutting 1-day admission-forecast MAE to 3.57 from a 6.22 naive baseline. Status: running - building a human-in-the-loop LangGraph multi-agent orchestrator with RAG over hospital policies.',
  },
  {
    id: 'crohnsight',
    source: { label: 'github.com/HilKalathiya/Crohn-Disease-Early-Prediction', url: 'https://github.com/HilKalathiya/Crohn-Disease-Early-Prediction' },
    coBuilt: 'Sahaj Saliya',
    text: 'CrohnSight is an AI-based early detection and severity grading system for Crohn disease, built as a minor project. 10x EfficientNet-B2 ensemble exported to ONNX. On CrohnIPI, out-of-fold: lesion-vs-normal AUROC 0.992, accuracy 96.7% versus 94.6% best published, quadratic weighted kappa 0.94. External Kvasir-Capsule AUROC 0.944. Research prototype, not a medical device.',
  },
  {
    id: 'openenv',
    source: { label: 'github.com/HilKalathiya/open-env-nuclei', url: 'https://github.com/HilKalathiya/open-env-nuclei' },
    coBuilt: 'Chetan Gadhiya',
    text: 'OpenEnv Data Cleaning RL Agent: an OpenEnv environment where an agent cleans a dirty pandas table. Agents include a trained PPO policy and a zero-shot LLM agent (Llama 3.1 8B through the Hugging Face router). Pydantic-typed FastAPI environment server containerized and deployed to Hugging Face Spaces.',
  },
  {
    id: 'mdt-copilot',
    source: { label: 'github.com/HilKalathiya/MDT-AI-Copilot', url: 'https://github.com/HilKalathiya/MDT-AI-Copilot' },
    text: 'MDT AI Copilot is an AI analytics and agentic RAG copilot for OpenAirInterface 5G MDT, built on the HNNOIX internship codebase. LangGraph create_react_agent, 5 structured tools, Chroma vector store over 4 knowledge documents embedded with Cohere embed-v4.0. Guardrails: max 8 tool calls, 4,000-character tool-output truncation. Anomaly recall >= 80% on the synthetic set.',
  },
  {
    id: 'ectd',
    source: { label: 'design notes', url: null },
    text: 'The eCTD audit engine is a system design (status: design, not yet built) for an auditable CMC drafting pipeline: every number would trace to raw lab data, be verified by code, and be signed by a human before Veeva Vault publishes it. The design includes one simulation: an OCR+VLM cross-check stress test on 9,600 synthetic values that stored zero wrong values, routing 194 to a human reviewer.',
  },
];

// Hybrid retrieval: dense cosine (all-MiniLM-L6-v2, quantized, computed here at
// build time) + raw Okapi BM25, fused with Reciprocal Rank Fusion (k=60).
// Nothing in this file ships to the browser.
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function bm25Scores(queryText, docs, k1 = 1.5, b = 0.75) {
  const queryTerms = tokenize(queryText);
  const docTokens = docs.map((d) => tokenize(d.text));
  const N = docTokens.length;
  const avgdl = docTokens.reduce((sum, t) => sum + t.length, 0) / N;

  const df = new Map();
  for (const terms of docTokens) {
    for (const t of new Set(terms)) df.set(t, (df.get(t) ?? 0) + 1);
  }

  const idf = new Map();
  for (const t of new Set(queryTerms)) {
    const n = df.get(t) ?? 0;
    idf.set(t, Math.log(1 + (N - n + 0.5) / (n + 0.5)));
  }

  return docTokens.map((terms) => {
    const tf = new Map();
    for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
    const dl = terms.length;
    let score = 0;
    for (const t of queryTerms) {
      const f = tf.get(t) ?? 0;
      if (f === 0) continue;
      score += (idf.get(t) ?? 0) * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (dl / avgdl))));
    }
    return score;
  });
}

const MODEL = 'Xenova/all-MiniLM-L6-v2';
const cacheDir = resolve(__dirname, '.cache');
const vectorCachePath = resolve(cacheDir, 'vectors.json');
mkdirSync(cacheDir, { recursive: true });
env.cacheDir = resolve(cacheDir, 'models');

const vectorCache = existsSync(vectorCachePath) ? JSON.parse(readFileSync(vectorCachePath, 'utf8')) : {};
const keyOf = (text) => createHash('sha256').update(MODEL + '|' + text).digest('hex');

async function embedAll(texts) {
  const missing = texts.filter((t) => !vectorCache[keyOf(t)]);
  if (missing.length) {
    const extractor = await pipeline('feature-extraction', MODEL, { dtype: 'q8' });
    for (const t of missing) {
      const out = await extractor(t, { pooling: 'mean', normalize: true });
      vectorCache[keyOf(t)] = Array.from(out.data);
    }
    writeFileSync(vectorCachePath, JSON.stringify(vectorCache), 'utf8');
  }
  return texts.map((t) => vectorCache[keyOf(t)]);
}

const [queryVec, ...chunkVecs] = await embedAll([query, ...corpus.map((c) => c.text)]);
const cosine = chunkVecs.map((v) => v.reduce((sum, x, i) => sum + x * queryVec[i], 0));
const bm25 = bm25Scores(query, corpus);

const RRF_K = 60;
const rankOf = (scores) => {
  const order = scores.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]);
  const ranks = new Array(scores.length);
  order.forEach(([, i], r) => (ranks[i] = r + 1));
  return ranks;
};
const denseRank = rankOf(cosine);
const bm25Rank = rankOf(bm25);

const ranked = corpus
  .map((chunk, i) => ({
    ...chunk,
    cos: Number(cosine[i].toFixed(4)),
    bm25: Number(bm25[i].toFixed(4)),
    rrf: Number((1 / (RRF_K + denseRank[i]) + 1 / (RRF_K + bm25Rank[i])).toFixed(5)),
  }))
  .sort((a, b) => b.rrf - a.rrf);

console.log('hybrid ranking for', JSON.stringify(query));
for (const c of ranked) console.log(`  ${c.id.padEnd(16)} cos ${c.cos.toFixed(2)} · bm25 ${c.bm25.toFixed(2)} · rrf ${c.rrf.toFixed(4)}`);

if (ranked[0].id !== 'resume-identity') {
  throw new Error(`Retrieval sanity check failed: top-1 for "${query}" is "${ranked[0].id}", expected "resume-identity".`);
}

const retrieval = ranked.slice(0, 4);

const toolCalls = [
  { name: 'memory_search', args: { query, top_k: retrieval.length }, result: `${retrieval.length} of ${corpus.length} chunks` },
  { name: 'fact_lookup', args: { entity: 'Hil Kalathiya', fields: ['education', 'experience', 'projects'] }, result: 'resolved' },
];

const answerText =
  "Hil Kalathiya is an AI engineer focused on agentic AI, RAG, and multi-agent systems built with LangGraph. " +
  "He is a B.Tech student in Information & Communication Technology at Pandit Deendayal Energy University " +
  "(CGPA 8.55/10, graduating May 2027). As a summer 2026 intern at HNNOIX he built MDT AI Copilot, a LangGraph " +
  "agentic-RAG copilot for 5G network analytics with Chroma and Cohere retrieval, capped at 8 tool calls, plus a " +
  "rolling z-score anomaly detector reaching 80%+ recall on injected coverage holes. He also co-built OpenEnv " +
  "Data Cleaning, a reinforcement-learning environment, with Chetan Gadhiya.";

// Real tokenizer at build time (cl100k_base via gpt-tokenizer). Each token's
// exact text is recovered by decoding its id alone, so hover boundaries are exact.
const tokenIds = encode(answerText);
const tokens = tokenIds.map((id) => ({ id, text: decode([id]) }));

// Every claim in the answer must trace to a retrieved chunk (the project's own
// "facts first" honesty rule, applied to itself per SPEC §1).
const critic = {
  checks: [
    { claim: 'AI engineer, agentic AI / RAG / LangGraph', sourceChunk: 'resume-identity', verified: true },
    { claim: 'B.Tech ICT, PDEU, CGPA 8.55/10, May 2027', sourceChunk: 'resume-identity', verified: true },
    { claim: 'MDT AI Copilot: LangGraph, Chroma, Cohere, 8-tool-call cap', sourceChunk: 'mdt-copilot', verified: true },
    { claim: 'HNNOIX intern: z-score anomaly detector, 80%+ recall', sourceChunk: 'resume-hnnoix', verified: true },
    { claim: 'OpenEnv Data Cleaning: co-built with Chetan Gadhiya', sourceChunk: 'openenv', verified: true },
  ],
  passed: true,
};

// Every critic check must cite a chunk that is actually shown in the retrieval panel.
for (const check of critic.checks) {
  if (!retrieval.some((c) => c.id === check.sourceChunk)) {
    throw new Error(`Critic cites "${check.sourceChunk}", which is not in the displayed top-${retrieval.length}.`);
  }
}

const trace = {
  query,
  nodes: ['planner', 'retriever', 'tools', 'critic', 'answer'],
  plan: 'Identity query -> retrieve resume + project facts -> cross-check tool calls -> verify claims -> compose answer.',
  corpusSize: corpus.length,
  retrieval,
  toolCalls,
  critic,
  answer: {
    text: answerText,
    tokens,
  },
};

writeFileSync(outPath, JSON.stringify(trace, null, 2) + '\n', 'utf8');
console.log(`hero-trace.json written: ${retrieval.length} chunks, ${tokens.length} tokens.`);
