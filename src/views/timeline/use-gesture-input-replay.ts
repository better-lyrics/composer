import { useSettingsStore } from "@/stores/settings";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useEffect, useRef } from "react";

// -- Interfaces ----------------------------------------------------------------
interface UseGestureInputReplayArgs {
  active: boolean;
  getLastPointer: () => { clientX: number; clientY: number } | null;
}

// -- Hook ----------------------------------------------------------------------
function useGestureInputReplay({ active, getLastPointer }: UseGestureInputReplayArgs) {
  const bypassRef = useRef(false);

  useEffect(() => {
    if (!active) {
      if (bypassRef.current) {
        bypassRef.current = false;
        useTimelineStore.getState().setIsBypassing(false);
      }
      return;
    }

    const replayLastPointer = () => {
      const last = getLastPointer();
      if (!last) return;
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: last.clientX,
          clientY: last.clientY,
          bubbles: true,
          pointerType: "mouse",
        }),
      );
    };

    const handleKey = (e: KeyboardEvent) => {
      const next = e.metaKey || e.ctrlKey;
      if (next === bypassRef.current) return;
      bypassRef.current = next;
      useTimelineStore.getState().setIsBypassing(next);
      replayLastPointer();
    };

    const unsubscribeSettings = useSettingsStore.subscribe((state, prev) => {
      if (state.timelineSnap !== prev.timelineSnap || state.vocalOnsetSnap !== prev.vocalOnsetSnap) {
        replayLastPointer();
      }
    });
    const unsubscribeTimeline = useTimelineStore.subscribe((state, prev) => {
      if (state.rollingEditMode !== prev.rollingEditMode) replayLastPointer();
    });

    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKey);
      unsubscribeSettings();
      unsubscribeTimeline();
    };
  }, [active, getLastPointer]);

  return bypassRef;
}

// -- Exports -------------------------------------------------------------------
export { useGestureInputReplay };
