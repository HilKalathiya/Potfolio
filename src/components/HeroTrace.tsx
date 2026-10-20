import { useEffect, useRef, useState } from 'react';

interface RetrievalChunk {
  id: string;
  source: { label: string; url: string | null };
  coBuilt?: string;
  text: string;
  cos: number;
  bm25: number;
  rrf: number;
}

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result: string;
}

interface CriticCheck {
  claim: string;
  sourceChunk: string;
  verified: boolean;
}

interface Token {
  id: number;
  text: string;
}

export interface HeroTraceData {
  query: string;
  nodes: string[];
  plan: string;
  corpusSize: number;
  retrieval: RetrievalChunk[];
  toolCalls: ToolCall[];
  critic: { checks: CriticCheck[]; passed: boolean };
  answer: { text: string; tokens: Token[] };
}

interface Props {
  trace: HeroTraceData;
}

type NodeState = 'pending' | 'running' | 'done';

const H = { w: 98, h: 34, gap: 21, y: 15 };
const V = { w: 120, h: 30, gap: 22, x: 10 };

function AgentGraph({
  nodes,
  stage,
  streaming,
  vertical,
}: {
  nodes: string[];
  stage: number;
  streaming: boolean;
  vertical: boolean;
}) {
  const stateOf = (i: number): NodeState => {
    if (stage === 0 || i > stage - 1) return 'pending';
    return i === stage - 1 ? 'running' : 'done';
  };

  const pos = (i: number) =>
    vertical
      ? { x: V.x, y: i * (V.h + V.gap), w: V.w, h: V.h }
      : { x: i * (H.w + H.gap), y: H.y, w: H.w, h: H.h };

  const edgePath = (i: number) => {
    const a = pos(i);
    const b = pos(i + 1);
    return vertical
      ? `M ${a.x + a.w / 2} ${a.y + a.h} L ${b.x + b.w / 2} ${b.y}`
      : `M ${a.x + a.w} ${a.y + a.h / 2} L ${b.x} ${b.y + b.h / 2}`;
  };

  const width = vertical ? V.w + V.x * 2 : nodes.length * H.w + (nodes.length - 1) * H.gap;
  const height = vertical ? nodes.length * V.h + (nodes.length - 1) * V.gap : H.h + H.y * 2;
  const markerId = vertical ? 'arrow-v' : 'arrow-h';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ maxWidth: vertical ? 160 : 574, height: 'auto' }}
      role="img"
      aria-label={`Agent graph: ${nodes.join(' → ')}`}
      className={vertical ? 'sm:hidden' : 'hidden sm:block'}
    >
      <defs>
        <marker id={markerId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--muted)" />
        </marker>
      </defs>

      {nodes.slice(0, -1).map((_, i) => {
        const travelling = stage === i + 2 && (stage < nodes.length || streaming);
        return (
          <g key={`edge-${i}`}>
            <path d={edgePath(i)} stroke="var(--border)" strokeWidth="1" fill="none" markerEnd={`url(#${markerId})`} />
            {travelling && (
              <circle r="2.5" fill="var(--accent)">
                <animateMotion dur="0.24s" repeatCount="indefinite" path={edgePath(i)} />
              </circle>
            )}
          </g>
        );
      })}

      {nodes.map((node, i) => {
        const p = pos(i);
        const state = stateOf(i);
        const running = state === 'running';
        return (
          <g key={node}>
            <rect
              x={p.x + 0.5}
              y={p.y + 0.5}
              width={p.w - 1}
              height={p.h - 1}
              rx="6"
              fill="var(--surface)"
              stroke={running ? 'var(--accent)' : 'var(--border)'}
              strokeWidth="1"
            />
            <text
              x={p.x + 10}
              y={p.y + p.h / 2}
              dominantBaseline="central"
              fontFamily="var(--font-mono)"
              fontSize="10.5"
              fill={running ? 'var(--text)' : 'var(--muted)'}
            >
              {node}
            </text>
            {state === 'done' && (
              <text
                x={p.x + p.w - 12}
                y={p.y + p.h / 2}
                dominantBaseline="central"
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize="10.5"
                fill="var(--muted)"
              >
                ✓
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// SPEC §5 Act 1: pre-recorded trace (src/data/hero-trace.json, built offline at
// build time). Default render shows the finished state — same markup with JS
// off or prefers-reduced-motion — then, when motion is allowed, rewinds and
// replays the planner → retriever → tools → critic → answer lighting order.
export default function HeroTrace({ trace }: Props) {
  const totalStages = trace.nodes.length;
  const totalTokens = trace.answer.tokens.length;
  const [stage, setStage] = useState(totalStages);
  const [tokenCount, setTokenCount] = useState(totalTokens);
  const tokenTimer = useRef<number | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    setStage(0);
    setTokenCount(0);

    const stageDelays = [0, 300, 650, 900, 1150];
    const timers = stageDelays.map((delay, i) =>
      window.setTimeout(() => setStage(i + 1), delay),
    );

    const streamStart = window.setTimeout(() => {
      let count = 0;
      tokenTimer.current = window.setInterval(() => {
        count += 1;
        setTokenCount(count);
        if (count >= totalTokens && tokenTimer.current) {
          window.clearInterval(tokenTimer.current);
        }
      }, 14);
    }, stageDelays[4] + 50);

    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(streamStart);
      if (tokenTimer.current) window.clearInterval(tokenTimer.current);
    };
  }, [trace, totalTokens]);

  const streaming = tokenCount < totalTokens;
  const chunksVisible = stage >= 2;
  const toolsVisible = stage >= 3;
  const criticVisible = stage >= 4;
  const answerVisible = stage >= 5;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
      <div className="order-1 flex flex-col gap-3 lg:order-2">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-base font-semibold text-text">Hil Kalathiya</span>
          <span className="font-mono text-xs text-muted">AI Engineer · Agentic AI, RAG, LangGraph</span>
        </p>
        <section aria-label="Answer" className="flex flex-col gap-2">
          <p
            className="answer-text"
            style={{ fontSize: 'clamp(1.25rem, 1.25vw + 0.6rem, 1.875rem)', lineHeight: 1.35 }}
          >
            {answerVisible &&
              trace.answer.tokens.slice(0, tokenCount).map((token, i) => (
                <span
                  key={i}
                  title={`token #${token.id} · ${JSON.stringify(token.text)}`}
                  className="token-span"
                >
                  {token.text}
                </span>
              ))}
            {answerVisible && streaming && <span className="stream-caret" aria-hidden="true" />}
          </p>
          <p className="font-mono text-[11px] text-muted">hover the answer to see its tokens</p>
        </section>
      </div>

      <div className="order-2 flex flex-col gap-6 lg:order-1">
        <p className="font-mono text-xs text-muted">
          query: <span className="text-text">&ldquo;{trace.query}&rdquo;</span>
        </p>

        <div>
          <AgentGraph nodes={trace.nodes} stage={stage} streaming={streaming} vertical={false} />
          <AgentGraph nodes={trace.nodes} stage={stage} streaming={streaming} vertical />
        </div>

        {stage >= 1 && <p className="max-w-prose font-mono text-xs text-muted">{trace.plan}</p>}

        {chunksVisible && (
          <section aria-label="Retrieved chunks" className="flex flex-col gap-2">
            <h2 className="font-mono text-xs text-muted">
              retrieved chunks · top {trace.retrieval.length} of {trace.corpusSize}
            </h2>
            <ul className="flex flex-col gap-1.5">
              {trace.retrieval.map((chunk) => (
                <li key={chunk.id}>
                  <details className="chunk rounded-token border border-border bg-surface">
                    <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 px-3 py-1.5 font-mono text-xs">
                      <span className="text-text">{chunk.id}</span>
                      {chunk.coBuilt && (
                        <span className="hidden text-[11px] text-muted sm:inline">co-built with {chunk.coBuilt}</span>
                      )}
                      <span className="ml-auto text-muted">
                        cos {chunk.cos.toFixed(2)} · bm25 {chunk.bm25.toFixed(2)} · rrf {chunk.rrf.toFixed(3)}
                      </span>
                    </summary>
                    <div className="flex flex-col gap-1.5 px-3 pb-3 pt-1">
                      <p className="text-sm text-muted">{chunk.text}</p>
                      <p className="flex flex-wrap items-baseline gap-x-3 font-mono text-[11px] text-muted">
                        {chunk.source.url ? (
                          <a href={chunk.source.url} target="_blank" rel="noopener noreferrer" className="underline">
                            {chunk.source.label}
                          </a>
                        ) : (
                          <span>{chunk.source.label}</span>
                        )}
                        {chunk.coBuilt && <span>co-built with {chunk.coBuilt}</span>}
                      </p>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        )}

        {toolsVisible && (
          <section aria-label="Tool calls" className="flex flex-col gap-2">
            <h2 className="font-mono text-xs text-muted">tool calls</h2>
            <ul className="flex flex-col gap-1 font-mono text-xs text-muted">
              {trace.toolCalls.map((call) => (
                <li key={call.name} className="break-words">
                  <span className="text-text">{call.name}</span>({JSON.stringify(call.args)}) → {call.result}
                </li>
              ))}
            </ul>
          </section>
        )}

        {criticVisible && (
          <section aria-label="Critic checks" className="flex flex-col gap-2">
            <h2 className="font-mono text-xs text-muted">critic</h2>
            <ul className="flex flex-col gap-1 font-mono text-xs">
              {trace.critic.checks.map((check) => (
                <li key={check.claim} className="text-muted">
                  <span style={{ color: check.verified ? 'var(--success)' : 'var(--error)' }}>
                    {check.verified ? '✓' : '✕'}
                  </span>{' '}
                  {check.claim} <span className="opacity-60">← {check.sourceChunk}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <style>{`
        .chunk summary {
          list-style: none;
        }
        .chunk summary::-webkit-details-marker {
          display: none;
        }
        .chunk summary::before {
          content: '+';
          color: var(--muted);
          width: 0.75rem;
        }
        .chunk[open] summary::before {
          content: '–';
        }
        .token-span {
          border-bottom: 1px dotted transparent;
        }
        .answer-text:hover .token-span {
          border-bottom-color: var(--border);
        }
        .token-span:hover {
          border-bottom-color: var(--muted);
          background: var(--surface);
        }
        .stream-caret {
          display: inline-block;
          width: 0.45em;
          height: 0.9em;
          margin-left: 2px;
          vertical-align: -0.1em;
          background: var(--accent);
          animation: caret-blink 900ms steps(1) infinite;
        }
        @keyframes caret-blink {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
