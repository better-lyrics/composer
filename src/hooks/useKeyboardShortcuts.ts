import { isMac } from "@/utils/platform";
import { useCallback, useEffect } from "react";

// -- Types --------------------------------------------------------------------

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  mod?: boolean;
  action: () => void;
  description: string;
}

interface ShortcutOptions {
  enabled?: boolean;
}

// -- Helpers ------------------------------------------------------------------

function matchesShortcut(event: KeyboardEvent, shortcut: Shortcut): boolean {
  const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
  const shiftMatches = !!shortcut.shift === event.shiftKey;
  const altMatches = !!shortcut.alt === event.altKey;

  const modActive = isMac ? event.metaKey : event.ctrlKey;
  const modMatches = !!shortcut.mod === modActive;

  const ctrlExpected = !!shortcut.ctrl;
  const metaExpected = !!shortcut.meta;
  const ctrlMatches = ctrlExpected === event.ctrlKey;
  const metaMatches = metaExpected === event.metaKey;

  if (shortcut.mod) {
    return keyMatches && modMatches && shiftMatches && altMatches;
  }

  return keyMatches && ctrlMatches && metaMatches && shiftMatches && altMatches;
}

// -- Hook ---------------------------------------------------------------------

function useKeyboardShortcuts(shortcuts: Shortcut[], options: ShortcutOptions = {}): void {
  const { enabled = true } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const target = event.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      for (const shortcut of shortcuts) {
        if (matchesShortcut(event, shortcut)) {
          if (isInput && !shortcut.ctrl && !shortcut.meta && !shortcut.mod) {
            continue;
          }
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts, enabled],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

export { useKeyboardShortcuts, matchesShortcut };
export type { Shortcut, ShortcutOptions };
