import { useEffect, useRef, useState } from 'react';

interface RetrievalChunk {
  id: string;
  source: string;
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

const NODE_LABELS: Record<string, string> = {
  planner: 'planner',
  retriever: 'retriever',
  tools: 'tools',
  critic: 'critic',
  answer: 'answer',
};

// SPEC §5 Act 1: pre-recorded trace (src/data/hero-trace.json, built offline at
// build time). Default render shows the finished state — same markup with JS
// off or prefers-reduced-motion — then, when motion is allowed, rewinds and
// replays the planner → retriever → tools → critic → answer lighting order.
export default function HeroTrace({ trace }: Props) {
  const totalStages = trace.nodes.length;
  const [stage, setStage] = useState(totalStages);
  const [tokenCount, setTokenCount] = useState(trace.answer.tokens.length);
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
        if (count >= trace.answer.tokens.length && tokenTimer.current) {
          window.clearInterval(tokenTimer.current);
        }
      }, 14);
    }, stageDelays[4] + 50);

    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(streamStart);
      if (tokenTimer.current) window.clearInterval(tokenTimer.current);
    };
  }, [trace]);

  const chunksVisible = stage >= 2;
  const toolsVisible = stage >= 3;
  const criticVisible = stage >= 4;
  const answerVisible = stage >= 5;

  return (
    <div className="flex flex-col gap-8">
      <p className="font-mono text-xs text-muted">
        query: <span className="text-text">&ldquo;{trace.query}&rdquo;</span>
      </p>

      <ol className="flex flex-wrap gap-3" aria-label="Agent run pipeline">
        {trace.nodes.map((node, i) => {
          const lit = stage > i;
          const active = stage === i + 1;
          return (
            <li
              key={node}
              className="flex items-center gap-2 rounded-token border px-3 py-1.5 font-mono text-xs"
              style={{
                borderColor: lit ? 'var(--accent)' : 'var(--border)',
                color: lit ? 'var(--text)' : 'var(--muted)',
                boxShadow: active ? '0 0 0 1px var(--accent)' : 'none',
                transitionProperty: 'border-color, color, box-shadow',
                transitionDuration: 'var(--motion-duration)',
                transitionTimingFunction: 'var(--motion-ease)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: lit ? 'var(--accent)' : 'var(--border)',
                  display: 'inline-block',
                }}
              />
              {NODE_LABELS[node] ?? node}
            </li>
          );
        })}
      </ol>

      {stage >= 1 && (
        <p className="font-mono text-xs text-muted max-w-prose">{trace.plan}</p>
      )}

      {chunksVisible && (
        <section aria-label="Retrieved chunks" className="flex flex-col gap-2">
          <h2 className="font-mono text-xs text-muted">retrieved chunks</h2>
          <ul className="flex flex-col gap-2">
            {trace.retrieval.map((chunk, i) => (
              <li
                key={chunk.id}
                className="chunk-in rounded-token border border-border bg-surface px-3 py-2"
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <div className="flex items-baseline justify-between gap-3 font-mono text-xs">
                  <span className="text-text">{chunk.id}</span>
                  <span className="text-muted">cos {chunk.cos.toFixed(2)} · bm25 {chunk.bm25.toFixed(2)} · rrf {chunk.rrf.toFixed(3)}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{chunk.text}</p>
                <p className="mt-1 font-mono text-[11px] text-muted opacity-70">{chunk.source}</p>
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
              <li key={call.name}>
                <span className="text-text">{call.name}</span>({JSON.stringify(call.args)}) →{' '}
                {call.result}
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

      {answerVisible && (
        <section aria-label="Answer" className="flex flex-col gap-2">
          <h2 className="font-mono text-xs text-muted">answer (hover a word for its token)</h2>
          <p className="text-base leading-relaxed">
            {trace.answer.tokens.slice(0, tokenCount).map((token, i) => (
              <span
                key={i}
                title={`token #${token.id} · ${JSON.stringify(token.text)}`}
                className="token-span"
              >
                {token.text}
              </span>
            ))}
            {tokenCount < trace.answer.tokens.length && <span className="stream-caret" aria-hidden="true" />}
          </p>
        </section>
      )}

      <style>{`
        .chunk-in {
          transition-property: opacity, transform;
          transition-duration: var(--motion-duration);
          transition-timing-function: var(--motion-ease);
        }
        .token-span {
          border-bottom: 1px dotted var(--border);
        }
        .token-span:hover {
          border-bottom-color: var(--accent);
          background: color-mix(in srgb, var(--accent) 12%, transparent);
        }
        .stream-caret {
          display: inline-block;
          width: 7px;
          height: 1em;
          margin-left: 2px;
          vertical-align: -0.15em;
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
