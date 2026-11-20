import type { ConfirmOptions } from "@/stores/confirm-store";
import { pluralize } from "@/utils/pluralize";

// -- Functions ----------------------------------------------------------------

// The confirm shown when an Edit change adds or removes rows inside linked instances.
function detachEditPrompt(labels: readonly string[], impactedCount: number): ConfirmOptions {
  const labelText =
    labels.length === 0
      ? pluralize(impactedCount, "instance")
      : labels.length === 1
        ? `[${labels[0]}]`
        : labels.map((l) => `[${l}]`).join(", ");
  return {
    title: `Detach ${labelText} to apply this edit?`,
    description: `Adding or removing rows inside ${
      labels.length === 1 ? `the ${labelText} group` : "these groups"
    } will detach ${impactedCount === 1 ? "this instance" : "these instances"} from the link. Other instances stay linked.`,
    confirmLabel: "Detach and apply",
    variant: "destructive",
    recoverable: true,
  };
}

// -- Exports ------------------------------------------------------------------

export { detachEditPrompt };
