import { type EscapeLayerKind, isTopEscapeLayer, useEscapeLayerStackStore } from "@/stores/escape-layer-stack";
import { useEffect, useEffectEvent } from "react";

// -- Hook ----------------------------------------------------------------------

// Escape belongs to the newest layer on the stack, so only the top layer closes.
function useEscapeLayer(kind: EscapeLayerKind, active: boolean, onEscape: () => void): void {
  const handleEscape = useEffectEvent(onEscape);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Effect Events always read current state and must not be dependencies.
  useEffect(() => {
    if (!active) return;
    const { push, pop } = useEscapeLayerStackStore.getState();
    const token = push(kind);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isTopEscapeLayer(token)) handleEscape();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      pop(token);
    };
  }, [kind, active]);
}

// -- Exports -------------------------------------------------------------------

export { useEscapeLayer };
