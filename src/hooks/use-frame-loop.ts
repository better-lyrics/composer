import { type FrameCallback, type FramePhases, subscribeFrame } from "@/lib/frame-loop";
import { useEffect, useRef } from "react";

// -- Hook ---------------------------------------------------------------------

function useFrameLoop(callback: FrameCallback | FramePhases, label: string, enabled = true): void {
  const callbackRef = useRef(callback);
  const hasPhases = typeof callback !== "function";

  // Assigned in an effect, never during render: React may replay or discard a render.
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (!enabled) return;
    const latest = () => callbackRef.current;
    const write = (now: number) => {
      const current = latest();
      if (typeof current === "function") current(now);
      else current.write(now);
    };
    if (!hasPhases) return subscribeFrame(write, label);
    const read = (now: number) => {
      const current = latest();
      if (typeof current !== "function") current.read(now);
    };
    return subscribeFrame({ read, write }, label);
  }, [enabled, label, hasPhases]);
}

// -- Exports ------------------------------------------------------------------

export { useFrameLoop };
