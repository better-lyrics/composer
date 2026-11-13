import type { Agent } from "@/domain/agent/model";
import type { RealignRefusal } from "@/domain/group/shared-placement";
import type { LinkGroup } from "@/domain/group/template";
import type { RawLine } from "@/domain/line/model";
import type { SyllableAddress } from "@/domain/selection/model";

// -- Types --------------------------------------------------------------------

interface LyricRoot {
  lines: RawLine[];
  groups: LinkGroup[];
  agents: Agent[];
}

type Refusal =
  | { reason: "line-gone"; lineId: string }
  | { reason: "word-gone"; address: SyllableAddress }
  | { reason: "copy-below-zero" }
  | { reason: "placement-out-of-range" }
  | { reason: "realign"; refusal: RealignRefusal }
  | { reason: "uneven-syllable-splits" }
  | { reason: "needs-detach-confirm"; impacted: string[] }
  | { reason: "needs-one-word"; selected: number }
  | { reason: "needs-one-run" };

// Refusals are returned, never thrown, so a caller cannot drop one without the type saying so.
type Outcome = { root: LyricRoot; touched: string[] } | { refused: Refusal };

// -- Functions ----------------------------------------------------------------

function applied(root: LyricRoot, touched: string[]): Outcome {
  return { root, touched };
}

function refused(refusal: Refusal): Outcome {
  return { refused: refusal };
}

function isRefused(outcome: Outcome): outcome is { refused: Refusal } {
  return "refused" in outcome;
}

function changedLineIds(before: readonly RawLine[], after: readonly RawLine[]): string[] {
  const beforeById = new Map(before.map((line) => [line.id, line]));
  return after.filter((line) => beforeById.get(line.id) !== line).map((line) => line.id);
}

// Returning the input root unchanged tells commit there is nothing to write.
function withLines(root: LyricRoot, lines: RawLine[] | null): Outcome {
  if (!lines || lines === root.lines) return applied(root, []);
  return applied({ ...root, lines }, changedLineIds(root.lines, lines));
}

// -- Exports ------------------------------------------------------------------

export type { LyricRoot, Outcome, Refusal };
export { applied, changedLineIds, isRefused, refused, withLines };
