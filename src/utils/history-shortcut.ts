import { getEffectiveBinding } from "@/stores/shortcut-bindings";
import { getShortcutById } from "@/stores/shortcut-registry";
import { isCommandBinding, matchesShortcutBinding } from "@/utils/shortcut-matcher";
import { isTypingTarget } from "@/utils/typing-target";

// -- Types --------------------------------------------------------------------

type HistoryAction = "undo" | "redo";

// -- Constants ----------------------------------------------------------------

const HISTORY_SHORTCUTS = (
  [
    { id: "global.undo", action: "undo" },
    { id: "global.redo", action: "redo" },
    { id: "global.redoAlternate", action: "redo" },
  ] satisfies { id: string; action: HistoryAction }[]
).filter(({ id }) => getShortcutById(id) !== undefined);

// -- Matching -----------------------------------------------------------------

function historyShortcutAction(event: KeyboardEvent): HistoryAction | null {
  for (const { id, action } of HISTORY_SHORTCUTS) {
    if (!matchesShortcutBinding(event, id)) continue;
    if (isTypingTarget(event.target) && !isCommandBinding(getEffectiveBinding(id))) return null;
    return action;
  }
  return null;
}

// -- Exports ------------------------------------------------------------------

export { historyShortcutAction };
export type { HistoryAction };
