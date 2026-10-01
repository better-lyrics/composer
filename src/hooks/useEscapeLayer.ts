import { isTopModal, useModalStackStore } from "@/stores/modal-stack";
import { useEffect, useRef } from "react";

// -- Hook ----------------------------------------------------------------------

// Escape belongs to the newest layer on the modal stack, so only the top layer closes.
function useEscapeLayer(active: boolean, onEscape: () => void): void {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const { push, pop } = useModalStackStore.getState();
    const token = push();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isTopModal(token)) onEscapeRef.current();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      pop(token);
    };
  }, [active]);
}

// -- Exports -------------------------------------------------------------------

export { useEscapeLayer };
