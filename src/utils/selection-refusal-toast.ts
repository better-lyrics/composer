import { toast } from "sonner";
import type { Refusal } from "@/domain/commands/outcome";
import type { SyllableAddress } from "@/domain/selection/model";
import { type SelectionCommand, selectionRefusal } from "@/domain/selection/selection-refusal";

// -- Constants -----------------------------------------------------------------

const SELECTION_REFUSAL_TOAST_ID = "selection-refusal";

// -- Functions -----------------------------------------------------------------

function refusalMessage(command: SelectionCommand, refusal: Refusal): string | null {
  if (refusal.reason === "needs-one-word") {
    return command === "editText" ? "Select one word to edit its text." : "Select one word to split it.";
  }
  if (refusal.reason !== "needs-one-run") return null;
  if (command === "joinSyllables") return "Select syllables on one line to join them.";
  return refusal.across === "lines"
    ? "Select words on one line to merge them."
    : "Merge main and background words separately.";
}

function showSelectionRefusal(command: SelectionCommand, selection: readonly SyllableAddress[]): void {
  const refusal = selectionRefusal(command, selection);
  const message = refusal && refusalMessage(command, refusal);
  if (message) toast(message, { id: SELECTION_REFUSAL_TOAST_ID });
}

// -- Exports -------------------------------------------------------------------

export { showSelectionRefusal };
