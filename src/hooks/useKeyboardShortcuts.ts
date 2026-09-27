import { isAnyModalOpen } from "@/stores/modal-stack";
import { getEffectiveBinding } from "@/stores/shortcut-bindings";
import { findMatchingShortcut } from "@/utils/shortcut-matcher";
import { useEffect, useRef } from "react";

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

  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!enabledRef.current) return;
      if (event.repeat) return;
      if (isAnyModalOpen()) return;

      const id = findMatchingShortcut(event, "global");
      const action = id === null ? undefined : actionsRef.current[id];
      if (!id || !action) return;

      const binding = getEffectiveBinding(id);
      if (isTypingTarget(event.target) && !binding.ctrl && !binding.meta && !binding.mod) return;

      event.preventDefault();
      action();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}

export { useKeyboardShortcuts };
