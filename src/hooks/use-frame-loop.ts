import { type FrameCallback, subscribeFrame } from "@/lib/frame-loop";
import { useEffect, useRef } from "react";

// -- Hook ---------------------------------------------------------------------

function useFrameLoop(callback: FrameCallback, enabled = true): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;
    return subscribeFrame((now) => callbackRef.current(now));
  }, [enabled]);
}

// -- Exports ------------------------------------------------------------------

export { useFrameLoop };
