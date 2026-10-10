import { getEffectiveBinding } from "@/stores/shortcut-bindings";
import { type ShortcutScope, getShortcutById, getShortcutsByScope } from "@/stores/shortcut-registry";
import { isCommandBinding, matchesShortcutBinding } from "@/utils/shortcut-matcher";
import { isTypingTarget } from "@/utils/typing-target";

// -- Types --------------------------------------------------------------------

type HistoryAction = "undo" | "redo";

interface HistoryShortcutOptions {
  scope?: ShortcutScope;
  redoOnY?: boolean;
}

// -- Constants ----------------------------------------------------------------

const HISTORY_SHORTCUTS = (
  [
    { id: "global.undo", action: "undo" },
    { id: "global.redo", action: "redo" },
    { id: "global.redoAlternate", action: "redo" },
  ] satisfies { id: string; action: HistoryAction }[]
).filter(({ id }) => getShortcutById(id) !== undefined);

const HISTORY_SHORTCUT_IDS = new Set(HISTORY_SHORTCUTS.map(({ id }) => id));

// -- Matching -----------------------------------------------------------------

function boundHistoryAction(event: KeyboardEvent): HistoryAction | null {
  for (const { id, action } of HISTORY_SHORTCUTS) {
    if (!matchesShortcutBinding(event, id)) continue;
    if (isTypingTarget(event.target) && !isCommandBinding(getEffectiveBinding(id))) return null;
    return action;
  }
  return null;
}

// The keys undo and redo answered to before they joined the registry.
function legacyHistoryAction(event: KeyboardEvent, redoOnY: boolean): HistoryAction | null {
  if (!(event.metaKey || event.ctrlKey)) return null;
  const key = event.key.toLowerCase();
  if (key === "z" || event.code === "KeyZ") return event.shiftKey ? "redo" : "undo";
  if (redoOnY && key === "y") return "redo";
  return null;
}

function isClaimedByOtherShortcut(event: KeyboardEvent, scope: ShortcutScope | undefined): boolean {
  const scopes: ShortcutScope[] = scope ? ["global", scope] : ["global"];
  return scopes.some((candidate) =>
    getShortcutsByScope(candidate).some(
      ({ id }) => !HISTORY_SHORTCUT_IDS.has(id) && matchesShortcutBinding(event, id),
    ),
  );
}

function historyShortcutAction(event: KeyboardEvent, options: HistoryShortcutOptions = {}): HistoryAction | null {
  const bound = boundHistoryAction(event);
  if (bound) return bound;
  const legacy = legacyHistoryAction(event, options.redoOnY ?? false);
  if (!legacy || isClaimedByOtherShortcut(event, options.scope)) return null;
  return legacy;
}

// -- Exports ------------------------------------------------------------------

export { historyShortcutAction };
export type { HistoryAction };
