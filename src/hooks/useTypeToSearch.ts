import { useModalStackStore } from "@/stores/modal-stack";
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

function useTypeToSearch(
  inputRef: RefObject<HTMLInputElement | null>,
  query: string,
  setQuery: (query: string) => void,
): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (useModalStackStore.getState().count > 1) return;
      if (event.key === "Escape") {
        if (query === "") return;
        event.preventDefault();
        event.stopPropagation();
        setQuery("");
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
      setQuery(query + event.key);
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [inputRef, query, setQuery]);
}

// -- Exports -------------------------------------------------------------------

export { useTypeToSearch };
