import { isTopModal, useModalStackStore } from "@/stores/modal-stack";
import { useEffect, useEffectEvent } from "react";

// -- Hook ----------------------------------------------------------------------

// Escape belongs to the newest layer on the modal stack, so only the top layer closes.
function useEscapeLayer(active: boolean, onEscape: () => void): void {
  const handleEscape = useEffectEvent(onEscape);

  useEffect(() => {
    if (!active) return;
    const { push, pop } = useModalStackStore.getState();
    const token = push();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isTopModal(token)) handleEscape();
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
