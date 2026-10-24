import { useSettingsStore } from "@/stores/settings";
import { holdsSnapBypass } from "@/views/timeline/snap-bypass-key";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useEffect, useRef } from "react";

// -- Interfaces ----------------------------------------------------------------
interface UseGestureInputReplayArgs {
  active: boolean;
  getLastPointer: () => { clientX: number; clientY: number } | null;
}

interface HeldModifiers {
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}

// -- Constants -----------------------------------------------------------------
const NO_MODIFIERS: HeldModifiers = { altKey: false, shiftKey: false, metaKey: false, ctrlKey: false };

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

    const held: HeldModifiers = { ...NO_MODIFIERS };
    let replaying = false;
    const trackModifiers = (e: KeyboardEvent | PointerEvent) => {
      if (replaying) return;
      held.altKey = e.altKey;
      held.shiftKey = e.shiftKey;
      held.metaKey = e.metaKey;
      held.ctrlKey = e.ctrlKey;
    };

    const replayLastPointer = () => {
      const last = getLastPointer();
      if (!last) return;
      replaying = true;
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: last.clientX,
          clientY: last.clientY,
          bubbles: true,
          pointerType: "mouse",
          ...held,
        }),
      );
      replaying = false;
    };

    const handleKey = (e: KeyboardEvent) => {
      trackModifiers(e);
      const next = holdsSnapBypass(e);
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
      if (state.rollingEditMode !== prev.rollingEditMode || state.vocalOnsetSnapPoints !== prev.vocalOnsetSnapPoints) {
        replayLastPointer();
      }
    });

    document.addEventListener("pointermove", trackModifiers, true);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKey);
    return () => {
      document.removeEventListener("pointermove", trackModifiers, true);
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
