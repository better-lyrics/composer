import type { Refusal } from "@/domain/commands/outcome";
import type { SyllableAddress } from "@/domain/selection/model";

// -- Types --------------------------------------------------------------------

type SelectionCommand = "editText" | "split" | "mergeWords" | "joinSyllables";

// -- Functions ----------------------------------------------------------------

// Read only after a command found no target, to say why. Null means the key stays silent.
function selectionRefusal(command: SelectionCommand, selection: readonly SyllableAddress[]): Refusal | null {
  if (command === "editText" || command === "split") {
    return selection.length > 1 ? { reason: "needs-one-word", selected: selection.length } : null;
  }
  const first = selection[0];
  if (!first) return null;
  if (selection.some((address) => address.lineId !== first.lineId)) return { reason: "needs-one-run", across: "lines" };
  if (command === "mergeWords" && selection.some((address) => address.type !== first.type)) {
    return { reason: "needs-one-run", across: "tracks" };
  }
  return null;
}

// -- Exports ------------------------------------------------------------------

export type { SelectionCommand };
export { selectionRefusal };
