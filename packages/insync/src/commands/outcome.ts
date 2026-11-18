import type { Part } from "../part";
import type { DocPassthrough } from "../passthrough";
import type { Agent } from "../agent";
import type { RealignRefusal } from "../group-shared-placement";
import type { LinkGroup } from "../group";
import type { LyricLine } from "../line";
import type { SyllableAddress } from "../selection-model";
import type { StepRefusal } from "../step-timing-step-write";
import type { MoveRejectReason } from "../word-move-across-lines";

// -- Types --------------------------------------------------------------------

interface LyricRoot {
  lines: LyricLine[];
  groups: LinkGroup[];
  agents: Agent[];
  parts: readonly Part[];
  passthrough: DocPassthrough;
}

type Refusal =
  | { reason: "line-gone"; lineId: string }
  | { reason: "lyrics-changed" }
  | { reason: "word-gone"; address: SyllableAddress }
  | { reason: "placement-out-of-range" }
  | { reason: "realign"; refusal: RealignRefusal }
  | { reason: "uneven-syllable-splits" }
  | { reason: "needs-one-word"; selected: number }
  | { reason: "needs-one-run"; across: "lines" | "tracks" }
  | { reason: "step"; refusal: StepRefusal }
  | { reason: "move"; reject: MoveRejectReason }
  | { reason: "early-tap-no-room" };

// Refusals are returned, never thrown, so a caller cannot drop one without the type saying so.
type Applied = { root: LyricRoot; touched: string[] };
type Outcome = Applied | { refused: Refusal };

// -- Functions ----------------------------------------------------------------

function applied(root: LyricRoot, touched: string[]): Applied {
  return { root, touched };
}

function refused(refusal: Refusal): { refused: Refusal } {
  return { refused: refusal };
}

function isRefused(outcome: Outcome): outcome is { refused: Refusal } {
  return "refused" in outcome;
}

function changedLineIds(before: readonly LyricLine[], after: readonly LyricLine[]): string[] {
  const beforeById = new Map(before.map((line) => [line.id, line]));
  return after.filter((line) => beforeById.get(line.id) !== line).map((line) => line.id);
}

// Returning the input root unchanged tells commit there is nothing to write.
function withLines(root: LyricRoot, lines: LyricLine[] | null): Outcome {
  if (!lines || lines === root.lines) return applied(root, []);
  return applied({ ...root, lines }, changedLineIds(root.lines, lines));
}

// -- Exports ------------------------------------------------------------------

export type { Applied, LyricRoot, Outcome, Refusal };
export { applied, changedLineIds, isRefused, refused, withLines };
