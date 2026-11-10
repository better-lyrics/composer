import { instanceBounds } from "@/domain/instance/bounds";
import { instancePositionsByLineId } from "@/domain/instance/enumerate";
import { lineInstanceKey } from "@/domain/instance/key";
import { isLinked } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";
import { type GroupFocus, effectiveFocus, isInFocus } from "@/views/timeline/group-focus";
import { timelineEffectiveLines } from "@/views/timeline/timeline-effective-lines";

// -- Interfaces ---------------------------------------------------------------

interface GroupHeaderRow {
  kind: "group-header";
  groupId: string;
  instanceIdx: number;
  ordinal: number;
  totalInstances: number;
  lineCount: number;
  instanceStart: number;
  instanceEnd: number;
  firstLineId: string;
}

interface LineEffectiveRow {
  kind: "line";
  line: LyricLine;
  lineIndex: number;
}

type EffectiveRow = GroupHeaderRow | LineEffectiveRow;

// -- Functions ----------------------------------------------------------------

function getEffectiveRows(lines: LyricLine[], focus: GroupFocus | null = null): EffectiveRow[] {
  const effective = timelineEffectiveLines(lines);
  const positions = instancePositionsByLineId(lines);
  const rows: EffectiveRow[] = [];
  let bufferStart = 0;
  let currentKey: string | null = null;

  const flushBuffer = (endExclusive: number) => {
    if (bufferStart >= endExclusive) return;
    const slice = effective.slice(bufferStart, endExclusive);
    const first = slice[0];

    if (isLinked(first)) {
      const bounds = instanceBounds(slice);
      const position = positions.get(first.id);
      if (bounds && position) {
        rows.push({
          kind: "group-header",
          groupId: first.groupId,
          instanceIdx: first.instanceIdx,
          ordinal: position.ordinal,
          totalInstances: position.count,
          lineCount: slice.length,
          instanceStart: bounds.begin,
          instanceEnd: bounds.end,
          firstLineId: first.id,
        });
      }
    }
    for (let i = 0; i < slice.length; i++) {
      rows.push({ kind: "line", line: slice[i], lineIndex: bufferStart + i });
    }
  };

  for (let i = 0; i < effective.length; i++) {
    const line = effective[i];
    const key = lineInstanceKey(line);
    if (key !== currentKey) {
      flushBuffer(i);
      bufferStart = i;
      currentKey = key;
    }
  }
  flushBuffer(effective.length);

  const shownFocus = effectiveFocus(lines, focus);
  if (shownFocus === null) return rows;
  return rows.filter((row) => row.kind === "line" && isInFocus(row.line, shownFocus));
}

// -- Exports ------------------------------------------------------------------

export { getEffectiveRows };
export type { EffectiveRow, GroupHeaderRow };
