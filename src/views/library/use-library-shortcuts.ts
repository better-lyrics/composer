import { isAnyModalOpen } from "@/stores/escape-layer-stack";
import { findMatchingShortcut } from "@/utils/shortcut-matcher";
import { useEffect, useRef } from "react";

// -- Types --------------------------------------------------------------------

interface LibraryShortcutHandlers {
  focusSearch: () => void;
  newProject: () => void;
  clearSelection: () => boolean;
  deleteSelection: () => boolean;
}

// -- Helpers ------------------------------------------------------------------

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.tagName === "TEXTAREA") return true;
  return target instanceof HTMLInputElement && target.type !== "checkbox";
}

// -- Hook ---------------------------------------------------------------------

function useLibraryShortcuts(handlers: LibraryShortcutHandlers): void {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.defaultPrevented || isAnyModalOpen()) return;
      const current = handlersRef.current;
      const global = findMatchingShortcut(event, "global");
      if (global === "global.openProjectSwitcher") {
        event.preventDefault();
        current.focusSearch();
        return;
      }
      if (global === "global.newProject") {
        event.preventDefault();
        current.newProject();
        return;
      }
      if (isTextEntry(event.target)) return;
      if (event.key === "Escape") {
        if (current.clearSelection()) event.preventDefault();
        return;
      }
      const matched = findMatchingShortcut(event, "library");
      if (matched === "library.focusSearch") {
        event.preventDefault();
        current.focusSearch();
      } else if (matched === "library.deleteSelection" && current.deleteSelection()) {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { useLibraryShortcuts };
