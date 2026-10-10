import { useModalStackStore } from "@/stores/modal-stack";
import { isTypingTarget } from "@/utils/typing-target";
import { type RefObject, useEffect } from "react";

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
