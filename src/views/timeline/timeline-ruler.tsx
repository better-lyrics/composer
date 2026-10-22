import { useAudioStore } from "@/stores/audio";
import { formatTime } from "@/utils/format-time";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { IconClock } from "@tabler/icons-react";
import { useEffect, useRef } from "react";

// -- Constants -----------------------------------------------------------------

// Labelled interval and its minor tick, in seconds, from the closest zoom out.
const RULER_STEPS: readonly (readonly [labelled: number, minor: number])[] = [
  [1, 0.25],
  [2, 0.5],
  [5, 1],
  [10, 2.5],
  [15, 5],
  [30, 10],
  [60, 15],
];
const MIN_LABEL_SPACING_PX = 56;
const TICK = "var(--color-composer-text-faint)";

// -- Helpers -------------------------------------------------------------------

function rulerStep(zoom: number): readonly [number, number] {
  return (
    RULER_STEPS.find(([labelled]) => labelled * zoom >= MIN_LABEL_SPACING_PX) ?? RULER_STEPS[RULER_STEPS.length - 1]
  );
}

function tickBackground(labelled: number, minor: number, zoom: number): React.CSSProperties {
  const ticks = (seconds: number) =>
    `repeating-linear-gradient(to right, ${TICK} 0 1px, transparent 1px ${seconds * zoom}px)`;
  return {
    backgroundImage: `${ticks(labelled)}, ${ticks(minor)}`,
    backgroundSize: "100% 10px, 100% 5px",
    backgroundPosition: "0 100%, 0 100%",
    backgroundRepeat: "no-repeat",
  };
}

// -- Components ----------------------------------------------------------------

// Lives outside the scroll container so the rows keep their geometry; follows its horizontal scroll by transform.
const TimelineRuler: React.FC<{ scrollContainerRef: React.RefObject<HTMLDivElement | null> }> = ({
  scrollContainerRef,
}) => {
  const duration = useAudioStore((s) => s.duration);
  const seekTo = useAudioStore((s) => s.seekTo);
  const zoom = useTimelineStore((s) => s.zoom);
  const trackRef = useRef<HTMLDivElement>(null);
  const [labelled, minor] = rulerStep(zoom);
  const labels = Array.from({ length: Math.floor(duration / labelled) + 1 }, (_, index) => index * labelled);

  // A passive effect: the scroll container mounts after this sibling, so its ref is set only once layout effects ran.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const follow = () => {
      if (trackRef.current) trackRef.current.style.translate = `${-container.scrollLeft}px 0`;
    };
    follow();
    container.addEventListener("scroll", follow, { passive: true });
    return () => container.removeEventListener("scroll", follow);
  }, [scrollContainerRef]);

  const seekToPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container || duration <= 0) return;
    const x = event.clientX - event.currentTarget.getBoundingClientRect().left + container.scrollLeft;
    seekTo(Math.min(duration, Math.max(0, x / zoom)));
  };

  return (
    <div aria-hidden="true" className="flex shrink-0 h-7 border-b border-(--divider) select-none">
      <div className="grid place-items-center w-12 shrink-0 bg-(--gutter-bg) border-r-2 border-(--divider) text-composer-text-faint">
        <IconClock className="size-[13px] opacity-60" />
      </div>
      <div className="relative flex-1 min-w-0 overflow-hidden cursor-pointer" onPointerDown={seekToPointer}>
        <div
          ref={trackRef}
          // react-doctor-disable-next-line react-doctor/no-permanent-will-change -- moved by the frame loop every frame while playing or scrolling, so it needs its own compositor layer
          className="absolute inset-y-0 left-0 will-change-[translate]"
          style={{ width: duration * zoom, ...tickBackground(labelled, minor, zoom) }}
        >
          {labels.map((time) => (
            <span
              key={time}
              className="absolute top-2 pl-[5px] font-mono text-[10.5px] font-medium leading-none text-composer-text-tertiary"
              style={{ left: time * zoom }}
            >
              {formatTime(time, 0)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelineRuler };
