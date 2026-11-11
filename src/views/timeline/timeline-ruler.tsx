import { notePlacement } from "@/lib/replay-cue";
import { useAudioStore } from "@/stores/audio";
import { CueMarker } from "@/views/timeline/cue-marker";
import { cn } from "@/utils/cn";
import { placeSnapPoint } from "@/views/timeline/place-snap-point";
import { noteReplaySpot } from "@/views/timeline/replay-spot-signal";
import { rulerStep } from "@/views/timeline/ruler-labels";
import { followRulerScroll } from "@/views/timeline/ruler-scroll";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { IconClock } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { useRulerLabels } from "@/views/timeline/use-ruler-labels";
import { readViewScroll } from "@/views/timeline/view-scroll";

// -- Constants -----------------------------------------------------------------

const LABELLED_TICK = "color-mix(in oklab, var(--color-composer-text-faint) 90%, transparent)";
const MINOR_TICK = "color-mix(in oklab, var(--color-composer-text-faint) 50%, transparent)";

// -- Helpers -------------------------------------------------------------------

function tickBackground(labelled: number, minor: number, zoom: number): React.CSSProperties {
  const ticks = (seconds: number, color: string) =>
    `repeating-linear-gradient(to right, ${color} 0 1px, transparent 1px ${seconds * zoom}px)`;
  return {
    backgroundImage: `${ticks(labelled, LABELLED_TICK)}, ${ticks(minor, MINOR_TICK)}`,
    backgroundSize: "100% 10px, 100% 5px",
    backgroundPosition: "0 100%, 0 100%",
    backgroundRepeat: "no-repeat",
  };
}

// -- Components ----------------------------------------------------------------

// Lives outside the scroll container so the rows keep their geometry; follows its horizontal scroll by transform.
interface TimelineRulerProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  trackRef: React.RefObject<HTMLDivElement | null>;
  laneRef: React.Ref<HTMLDivElement>;
  markerHostRef: React.Ref<HTMLDivElement>;
}

const TimelineRuler: React.FC<TimelineRulerProps> = ({ scrollContainerRef, trackRef, laneRef, markerHostRef }) => {
  const duration = useAudioStore((s) => s.duration);
  const seekTo = useAudioStore((s) => s.seekTo);
  const zoom = useTimelineStore((s) => s.zoom);
  const markerMode = useTimelineStore((s) => s.markerMode);
  const [labelled, minor] = rulerStep(zoom);
  const labelHostRef = useRef<HTMLDivElement>(null);
  useRulerLabels(trackRef, labelHostRef, duration, zoom);

  // A passive effect: the scroll container mounts after this sibling, so its ref is set only once layout effects ran.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container && trackRef.current) followRulerScroll(trackRef.current, readViewScroll(container).left);
  }, [scrollContainerRef, trackRef]);

  const seekToPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container || duration <= 0 || event.button !== 0) return;
    const x = event.clientX - event.currentTarget.getBoundingClientRect().left + readViewScroll(container).left;
    const time = Math.min(duration, Math.max(0, x / zoom));
    if (useTimelineStore.getState().markerMode || event.altKey) placeSnapPoint(time);
    else {
      seekTo(time);
      notePlacement(time, "pointer");
      noteReplaySpot(time);
    }
  };

  return (
    <div className="relative flex shrink-0 h-7 select-none">
      <div
        aria-hidden="true"
        className="grid place-items-center w-12 shrink-0 bg-(--gutter-bg) shadow-[inset_-2px_0_0_var(--divider),inset_0_-1px_0_var(--divider)] text-composer-text-faint"
      >
        <IconClock className="size-[13px] opacity-60" />
      </div>
      <div
        ref={laneRef}
        className={cn("relative flex-1 min-w-0 overflow-hidden", markerMode ? "cursor-crosshair" : "cursor-pointer")}
        onPointerDown={seekToPointer}
      >
        <div
          ref={trackRef}
          // react-doctor-disable-next-line react-doctor/no-permanent-will-change -- moved by the frame loop every frame while playing or scrolling, so it needs its own compositor layer
          className="absolute inset-y-0 left-0 will-change-[translate]"
          style={{ width: duration * zoom, ...tickBackground(labelled, minor, zoom) }}
        >
          <div ref={labelHostRef} className="contents" />
          <div ref={markerHostRef} className="absolute inset-0 pointer-events-none" />
          <CueMarker />
        </div>
      </div>
      {markerMode && (
        <div aria-hidden="true" className="marker-zone-armed absolute top-0 left-12 right-0 z-10 pointer-events-none" />
      )}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelineRuler };
