import type { ModalNavSection } from "@/ui/modal-nav-layout";

// -- Component -----------------------------------------------------------------

const MatchCount: React.FC<{ count: number }> = ({ count }) => (
  <span className="font-mono text-[11px] tabular-nums text-composer-accent-text">{count}</span>
);

// -- Helpers -------------------------------------------------------------------

function withMatchCounts<T extends string>(
  sections: readonly ModalNavSection<T>[],
  counts: Partial<Record<T, number>>,
): ModalNavSection<T>[] {
  return sections.map((section) => {
    const count = counts[section.id] ?? 0;
    return { ...section, dimmed: count === 0, trailing: count > 0 ? <MatchCount count={count} /> : undefined };
  });
}

// -- Exports -------------------------------------------------------------------

export { MatchCount, withMatchCounts };
