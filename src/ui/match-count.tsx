// -- Component -----------------------------------------------------------------

const MatchCount: React.FC<{ count: number }> = ({ count }) => (
  <span className="font-mono text-[11px] tabular-nums text-composer-accent-text">{count}</span>
);

// -- Exports -------------------------------------------------------------------

export { MatchCount };
