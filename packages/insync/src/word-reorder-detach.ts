import type { LinkGroup } from "./group";
import { sharesTiming } from "./group-shared-timing";
import { isLinked } from "./instance-predicates";
import type { LineUpdate, LyricLine } from "./line";
import { backgroundText, lineText } from "./line-text";

// -- Functions ----------------------------------------------------------------

// A reorder that changes a line's text order cannot reach instances on their own times, so that line becomes its
// instance's own, as a move across lines does.
function withReorderDetaches(
  lines: readonly LyricLine[],
  groups: readonly LinkGroup[],
  updates: readonly LineUpdate[],
  splitChar: string,
): { updates: LineUpdate[]; detachedIds: string[] } {
  const byId = new Map(lines.map((line) => [line.id, line]));
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const detachedIds: string[] = [];
  const detached = updates.map((update) => {
    const line = byId.get(update.id);
    if (!line || !isLinked(line) || line.detached) return update;
    if (sharesTiming(groupsById.get(line.groupId), line.instanceIdx)) return update;
    const after = { ...line, ...update.updates };
    const sameOrder =
      lineText(after, splitChar) === lineText(line, splitChar) &&
      backgroundText(after, splitChar) === backgroundText(line, splitChar);
    if (sameOrder) return update;
    detachedIds.push(update.id);
    return { id: update.id, updates: { ...update.updates, detached: true } };
  });
  return { updates: detached, detachedIds };
}

// -- Exports ------------------------------------------------------------------

export { withReorderDetaches };
