import { SPECTRUM_BAND_HEIGHT, clampSpectrumBandHeight } from "@/domain/spectrum/settings";
import { holdFrames } from "@/lib/frame-loop";
import { useSettingsStore } from "@/stores/settings";
import { currentOverviewBandHeight } from "@/views/timeline/overview-band-height";
import { useCallback, useEffect, useRef } from "react";

// -- Constants -----------------------------------------------------------------

const RESIZING_ATTRIBUTE = "data-overview-resizing";
const KEY_STEP_PX = 8;
const KEY_STEP_LARGE_PX = 32;

// -- Helpers -------------------------------------------------------------------

function persistBandHeight(px: number): void {
  useSettingsStore.getState().set("spectrumBandHeight", clampSpectrumBandHeight(px));
}

// -- Hook ----------------------------------------------------------------------

// Every reader of the band height follows the drag, so each move writes the one owner.
function useBandResize() {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    cleanupRef.current?.();
    const handle = e.currentTarget;
    const host = handle.closest<HTMLElement>("[data-scroll-container]");
    const startY = e.clientY;
    const startHeight = currentOverviewBandHeight();
    const releaseFrames = holdFrames("spectrum band resize");

    const handlePointerMove = (moveEvent: PointerEvent) => persistBandHeight(startHeight + moveEvent.clientY - startY);
    const handleEnd = () => cleanupRef.current?.();

    cleanupRef.current = () => {
      cleanupRef.current = null;
      releaseFrames();
      host?.removeAttribute(RESIZING_ATTRIBUTE);
      handle.removeEventListener("pointermove", handlePointerMove);
      handle.removeEventListener("pointerup", handleEnd);
      handle.removeEventListener("pointercancel", handleEnd);
      handle.removeEventListener("lostpointercapture", handleEnd);
    };
    handle.setPointerCapture(e.pointerId);
    host?.setAttribute(RESIZING_ATTRIBUTE, "");
    handle.addEventListener("pointermove", handlePointerMove);
    handle.addEventListener("pointerup", handleEnd);
    handle.addEventListener("pointercancel", handleEnd);
    handle.addEventListener("lostpointercapture", handleEnd);
  }, []);

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    persistBandHeight(SPECTRUM_BAND_HEIGHT.min);
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = e.shiftKey ? KEY_STEP_LARGE_PX : KEY_STEP_PX;
    const height = currentOverviewBandHeight();
    const next =
      e.key === "ArrowDown"
        ? height + step
        : e.key === "ArrowUp"
          ? height - step
          : e.key === "Home"
            ? SPECTRUM_BAND_HEIGHT.min
            : e.key === "End"
              ? SPECTRUM_BAND_HEIGHT.max
              : null;
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    persistBandHeight(next);
  }, []);

  return { onPointerDown, onDoubleClick, onKeyDown };
}

// -- Exports -------------------------------------------------------------------

export { useBandResize };
