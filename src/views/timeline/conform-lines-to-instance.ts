import { instanceBounds } from "@/domain/instance/bounds";
import type { LineTemplate } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import { applyInstanceTemplate, type InstanceApplyResult } from "@/views/timeline/apply-instance-template";
import { lineIdsAreContiguous, selectionTouchesAnyGroup } from "@/views/timeline/group-ops";

// -- Interfaces ----------------------------------------------------------------

interface ConformInput {
  lines: LyricLine[];
  groupId: string;
  template: LineTemplate[];
  selectedLineIds: ReadonlySet<string>;
  playheadTime: number;
}

type ConformFailure =
  | "empty_selection"
  | "no_template"
  | "already_grouped"
  | "unknown_line"
  | "not_contiguous"
  | "length_mismatch";

type ConformResult = InstanceApplyResult<ConformFailure>;

// -- Operation -----------------------------------------------------------------

function conformLinesToInstance({
  lines,
  groupId,
  template,
  selectedLineIds,
  playheadTime,
}: ConformInput): ConformResult {
  if (selectedLineIds.size === 0) return { ok: false, reason: "empty_selection" };
  if (template.length === 0) return { ok: false, reason: "no_template" };
  if (selectionTouchesAnyGroup(lines, selectedLineIds)) return { ok: false, reason: "already_grouped" };

  const knownIds = new Set(lines.map((line) => line.id));
  for (const id of selectedLineIds) {
    if (!knownIds.has(id)) return { ok: false, reason: "unknown_line" };
  }
  if (!lineIdsAreContiguous(lines, selectedLineIds)) return { ok: false, reason: "not_contiguous" };
  if (selectedLineIds.size !== template.length) return { ok: false, reason: "length_mismatch" };

  const startIndex = lines.findIndex((line) => selectedLineIds.has(line.id));
  const selected = lines.slice(startIndex, startIndex + template.length);
  const instanceStart = instanceBounds(selected)?.begin ?? playheadTime;

  const { updatedLines, instanceIdx } = applyInstanceTemplate({
    lines,
    groupId,
    template,
    startIndex,
    instanceStart,
  });

  return { ok: true, updatedLines, instanceIdx };
}

// -- Exports -------------------------------------------------------------------

export { conformLinesToInstance };
export type { ConformFailure };
