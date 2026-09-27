import { MatchCount } from "@/ui/match-count";
import type { ModalNavSection } from "@/ui/modal-nav-layout";

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

export { withMatchCounts };
