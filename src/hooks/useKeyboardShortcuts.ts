import { isAnyModalOpen } from "@/stores/modal-stack";
import { getEffectiveBinding } from "@/stores/shortcut-bindings";
import { findMatchingShortcut } from "@/utils/shortcut-matcher";
import { useEffect, useEffectEvent } from "react";

// -- Types --------------------------------------------------------------------

type ShortcutActions = Partial<Record<string, () => void>>;

interface ShortcutOptions {
  enabled?: boolean;
}

// -- Helpers ------------------------------------------------------------------

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

// -- Hook ---------------------------------------------------------------------

function useKeyboardShortcuts(actions: ShortcutActions, options: ShortcutOptions = {}): void {
  const { enabled = true } = options;

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!enabled) return;
    if (event.repeat) return;
    if (isAnyModalOpen()) return;

    const id = findMatchingShortcut(event, "global");
    const action = id === null ? undefined : actions[id];
    if (!id || !action) return;

    const binding = getEffectiveBinding(id);
    if (isTypingTarget(event.target) && !binding.ctrl && !binding.meta && !binding.mod) return;

    event.preventDefault();
    action();
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: Effect Events always read current state and must not be dependencies.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => handleKeyDown(event);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

export { useKeyboardShortcuts };
