import { useEffect, useState } from 'react';
import { readStorage, writeStorage } from '../lib/storage';

interface Props {
  nodeCount: number;
  chunkCount: number;
}

// SPEC §5 Act 0 (≤2s): black screen, mono boot lines with real counts, a skip
// button after 1s, and instant skip for returning visitors. Renders nothing
// server-side / without JS, so a no-JS visit goes straight to Act 1.
export default function BootSequence({ nodeCount, chunkCount }: Props) {
  const [visible, setVisible] = useState(false);
  const [lineCount, setLineCount] = useState(0);
  const [showSkip, setShowSkip] = useState(false);

  function finish() {
    writeStorage('boot-seen', '1');
    setVisible(false);
  }

  useEffect(() => {
    if (readStorage('boot-seen') === '1') return;
    setVisible(true);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setLineCount(3);
      setShowSkip(true);
      const t = window.setTimeout(finish, 50);
      return () => window.clearTimeout(t);
    }

    const timers = [
      window.setTimeout(() => setLineCount(1), 0),
      window.setTimeout(() => setLineCount(2), 400),
      window.setTimeout(() => setLineCount(3), 800),
      window.setTimeout(() => setShowSkip(true), 1000),
      window.setTimeout(finish, 1800),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, []);

  if (!visible) return null;

  const lines = ['loading weights…', `mounting tools (${nodeCount})…`, `memory index: ${chunkCount} chunks…`];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-1 bg-bg font-mono text-sm text-text"
      role="status"
      aria-live="polite"
    >
      {lines.slice(0, lineCount).map((line) => (
        <p key={line}>{line}</p>
      ))}
      {showSkip && (
        <button
          type="button"
          onClick={finish}
          className="mt-6 rounded-token border border-border px-2.5 py-1 font-mono text-xs text-muted hover:text-text hover:border-accent"
        >
          skip
        </button>
      )}
    </div>
  );
}
