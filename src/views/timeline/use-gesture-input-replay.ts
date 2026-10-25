import { useProjectStore } from "@/stores/project";
import type { SnapSettings } from "@/stores/settings-snap";
import { useSettingsStore } from "@/stores/settings";
import { holdsSnapBypass } from "@/views/timeline/snap-bypass-key";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useEffect, useRef } from "react";

// -- Interfaces ----------------------------------------------------------------
interface HeldModifiers {
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}

interface LastPointer extends Partial<HeldModifiers> {
  clientX: number;
  clientY: number;
}

interface UseGestureInputReplayArgs {
  active: boolean;
  getLastPointer: () => LastPointer | null;
}

// -- Constants -----------------------------------------------------------------
const NO_MODIFIERS: HeldModifiers = { altKey: false, shiftKey: false, metaKey: false, ctrlKey: false };
const SNAP_SOURCE_SETTINGS: readonly (keyof SnapSettings)[] = [
  "timelineSnap",
  "vocalOnsetSnap",
  "beatSnap",
  "beatGridVisible",
  "beatGridLines",
  "snapWordsAndLines",
  "snapMarkers",
];

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

    bypassRef.current = useTimelineStore.getState().isBypassing;
    const lastPointer = getLastPointer();
    const held: HeldModifiers = {
      altKey: lastPointer?.altKey ?? NO_MODIFIERS.altKey,
      shiftKey: lastPointer?.shiftKey ?? NO_MODIFIERS.shiftKey,
      metaKey: lastPointer?.metaKey ?? NO_MODIFIERS.metaKey,
      ctrlKey: lastPointer?.ctrlKey ?? NO_MODIFIERS.ctrlKey,
    };
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

    let disposed = false;
    // The wheel handler sets zoom before it re-anchors the scroll, so replay once both are in place.
    const replayAfterZoom = () =>
      queueMicrotask(() => {
        if (!disposed) replayLastPointer();
      });

    const handleKey = (e: KeyboardEvent) => {
      trackModifiers(e);
      const next = holdsSnapBypass(e);
      if (next === bypassRef.current) return;
      bypassRef.current = next;
      useTimelineStore.getState().setIsBypassing(next);
      replayLastPointer();
    };

    const unsubscribeSettings = useSettingsStore.subscribe((state, prev) => {
      if (SNAP_SOURCE_SETTINGS.some((key) => state[key] !== prev[key])) replayLastPointer();
    });
    const unsubscribeProject = useProjectStore.subscribe((state, prev) => {
      if (state.beatGrid !== prev.beatGrid) replayLastPointer();
    });
    const unsubscribeTimeline = useTimelineStore.subscribe((state, prev) => {
      if (
        state.rollingEditMode !== prev.rollingEditMode ||
        state.vocalOnsetSnapPoints !== prev.vocalOnsetSnapPoints ||
        state.scrollLeft !== prev.scrollLeft
      ) {
        replayLastPointer();
      } else if (state.zoom !== prev.zoom) {
        replayAfterZoom();
      }
    });

    document.addEventListener("pointermove", trackModifiers, true);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKey);
    return () => {
      disposed = true;
      document.removeEventListener("pointermove", trackModifiers, true);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKey);
      unsubscribeSettings();
      unsubscribeProject();
      unsubscribeTimeline();
    };
  }, [active, getLastPointer]);

  return bypassRef;
}

// -- Exports -------------------------------------------------------------------
export { type LastPointer, useGestureInputReplay };
