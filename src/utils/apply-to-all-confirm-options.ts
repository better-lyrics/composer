import type { ConfirmOptions } from "@/stores/confirm-store";
import { pluralize } from "@/utils/pluralize";

// -- Types --------------------------------------------------------------------

interface ApplyToAllConfirmParams {
  identicalCount: number;
  sourceText: string;
}

// -- Helper -------------------------------------------------------------------

function buildApplyToAllConfirmOptions({ identicalCount, sourceText }: ApplyToAllConfirmParams): ConfirmOptions {
  return {
    title: `Split ${identicalCount + 1} matching "${sourceText}"?`,
    description: `Apply this split to the source and ${pluralize(identicalCount, "other match", "other matches")}.`,
    confirmLabel: "Split",
    cancelLabel: "Cancel",
    variant: "primary",
    settingsKey: "confirmApplyToAllSyllableSplit",
    recoverable: true,
  };
}

// -- Exports ------------------------------------------------------------------

export { buildApplyToAllConfirmOptions };
