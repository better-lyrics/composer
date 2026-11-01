import { scrubPreview } from "@/audio/scrub-preview";
import { DEFAULT_SCRUB_OPTS, type ScrubSample, computeScrubVelocity } from "@/audio/scrub-velocity";
import { notePlacement } from "@/lib/replay-cue";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { computeAnchoredScrollLeft } from "@/utils/timeline/zoom-anchor";
import { currentOverviewBandHeight } from "@/views/timeline/overview-band-height";
import { GUTTER_WIDTH, MAX_ZOOM, MIN_ZOOM, ZOOM_STEP, useTimelineStore } from "@/views/timeline/timeline-store";
import { computeScrubTime, decideWheelAction, normalizeWheelDelta } from "@/views/timeline/timeline-wheel";
import { type RefObject, useCallback, useEffect, useRef } from "react";
import { readViewScroll, scrollView, scrollViewBy } from "@/views/timeline/view-scroll";

// -- Constants -----------------------------------------------------------------

const WHEEL_IDLE_MS = 120;

// -- Hook ----------------------------------------------------------------------

function useTimelineWheel(scrollContainerRef: RefObject<HTMLDivElement | null>, enabled: boolean) {
  const prevScrubSampleRef = useRef<ScrubSample | null>(null);
  const wheelIdleTimerRef = useRef<number | null>(null);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const duration = useAudioStore.getState().duration;
      if (duration <= 0) return;
      const zoom = useTimelineStore.getState().zoom;

      const rect = container.getBoundingClientRect();
      const overWaveform =
        e.clientY >= rect.top &&
        e.clientY <= rect.top + currentOverviewBandHeight() &&
        e.clientX >= rect.left + GUTTER_WIDTH;

      const action = decideWheelAction({
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        overWaveform,
        horizontalScrollSetting: useSettingsStore.getState().timelineHorizontalScroll,
      });

      if (action.kind === "native") return;
      e.preventDefault();

      if (action.kind === "zoom") {
        const anchorViewportX = e.clientX - rect.left - GUTTER_WIDTH;
        const cursorTime = (anchorViewportX + readViewScroll(container).left) / zoom;
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
        if (newZoom === zoom) return;
        useTimelineStore.getState().setZoom(newZoom);
        scrollView(container, computeAnchoredScrollLeft(cursorTime, anchorViewportX, newZoom));
        return;
      }

      if (action.kind === "scrub") {
        const currentTime = livePlaybackTime();
        const newTime = computeScrubTime(currentTime, normalizeWheelDelta(e.deltaY, e.deltaMode), zoom, duration);
        useAudioStore.getState().seekTo(newTime);
        notePlacement(newTime, "keyboard");

        const curr: ScrubSample = { time: newTime, wallClockMs: performance.now() };
        const velocity = computeScrubVelocity(prevScrubSampleRef.current, curr, DEFAULT_SCRUB_OPTS);
        prevScrubSampleRef.current = curr;
        if (velocity > 0) scrubPreview.play(newTime, velocity);

        if (wheelIdleTimerRef.current !== null) window.clearTimeout(wheelIdleTimerRef.current);
        wheelIdleTimerRef.current = window.setTimeout(() => {
          scrubPreview.stop();
          prevScrubSampleRef.current = null;
          wheelIdleTimerRef.current = null;
        }, WHEEL_IDLE_MS);
        return;
      }

      const dominantDelta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      const scrollAmount = normalizeWheelDelta(dominantDelta, e.deltaMode);
      if (action.axis === "x") scrollViewBy(container, scrollAmount, 0);
      else scrollViewBy(container, 0, scrollAmount);
    },
    [scrollContainerRef],
  );

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!enabled || !container) return;
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
      if (wheelIdleTimerRef.current !== null) {
        window.clearTimeout(wheelIdleTimerRef.current);
        wheelIdleTimerRef.current = null;
      }
      scrubPreview.stop();
      prevScrubSampleRef.current = null;
    };
  }, [enabled, handleWheel, scrollContainerRef]);
}

// -- Exports -------------------------------------------------------------------

export { useTimelineWheel };
