import { useModalStackStore } from "@/stores/modal-stack";
import { useUIStore } from "@/stores/ui";
import { type RefObject, useEffect } from "react";

// -- Helpers -------------------------------------------------------------------

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

// -- Hook ----------------------------------------------------------------------

function useSettingsSearchKeys(inputRef: RefObject<HTMLInputElement | null>): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (useModalStackStore.getState().count > 1) return;
      const { settingsQuery, setSettingsQuery } = useUIStore.getState();

      if (event.key === "Escape") {
        if (settingsQuery === "") return;
        event.preventDefault();
        event.stopPropagation();
        setSettingsQuery("");
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      if (event.key === "/") {
        event.preventDefault();
        inputRef.current?.focus();
        return;
      }

      if (event.key.length !== 1 || event.key === " ") return;
      event.preventDefault();
      inputRef.current?.focus({ preventScroll: true });
      setSettingsQuery(settingsQuery + event.key);
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [inputRef]);
}

// -- Exports -------------------------------------------------------------------

export { useSettingsSearchKeys };
