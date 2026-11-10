import { useFrameLoop } from "@/hooks/use-frame-loop";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { GUTTER_WIDTH } from "@/views/timeline/coords";
import { CueFlash } from "@/views/timeline/cue-flash";
import { createPlayheadFrame, readPlayheadFrame, writePlayheadFrame } from "@/views/timeline/playhead-frame";
import { createPlayheadDrag } from "@/views/timeline/playhead-drag";
import { snapPlayheadTime } from "@/views/timeline/playhead-snap";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

// -- Types ---------------------------------------------------------------------

interface TimelinePlayheadProps {
  containerHeight: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  capHost?: HTMLElement | null;
  rulerTrackRef?: React.RefObject<HTMLDivElement | null>;
}

// -- Constants -----------------------------------------------------------------

const HIT_BUFFER_PX = 18;
const RULER_DRAG_THRESHOLD_PX = 3;

// -- Helpers -------------------------------------------------------------------

// -- Component -----------------------------------------------------------------

// The grabbable cap rides in the ruler, above the rows, with a short stem down to the line.
const PlayheadCap: React.FC<{ ref: React.Ref<HTMLDivElement>; onMouseDown: React.MouseEventHandler }> = ({
  ref,
  onMouseDown,
}) => (
  // react-doctor-disable-next-line react-doctor/no-permanent-will-change -- moved by the frame loop every frame while playing or scrolling, so it needs its own compositor layer
  <div ref={ref} aria-hidden="true" className="timeline-playhead-cap absolute inset-y-0 left-0 w-0 pointer-events-none">
    <div className="absolute top-[18px] bottom-0 -left-px w-0.5 bg-composer-accent" />
    {/* react-doctor-disable-next-line react-doctor/no-static-element-interactions -- a pointer-only grip; keyboard and assistive tech use the Playhead separator */}
    <div
      className="absolute top-0.5 -left-2 flex justify-center gap-0.5 w-4 h-5 pt-1.5 rounded-[6px_6px_8px_8px] bg-composer-accent shadow-[inset_0_1px_0_color-mix(in_oklab,white_40%,transparent)] cursor-grab active:cursor-grabbing pointer-events-auto"
      onMouseDown={onMouseDown}
    >
      <i className="block w-[1.5px] h-2 rounded-[1px] bg-[color-mix(in_oklab,white_55%,transparent)]" />
      <i className="block w-[1.5px] h-2 rounded-[1px] bg-[color-mix(in_oklab,white_55%,transparent)]" />
    </div>
  </div>
);

const TimelinePlayhead: React.FC<TimelinePlayheadProps> = ({
  containerHeight,
  scrollContainerRef,
  capHost,
  rulerTrackRef,
}) => {
  const duration = useAudioStore((s) => s.duration);
  const seekTo = useAudioStore((s) => s.seekTo);
  const setIsPlaying = useAudioStore((s) => s.setIsPlaying);

  const setDraggingPlayhead = useTimelineStore((s) => s.setDraggingPlayhead);
  const setDragTime = useTimelineStore((s) => s.setDragTime);

  const containerRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const capRef = useRef<HTMLDivElement>(null);
  const [frame] = useState(createPlayheadFrame);

  const elements = useMemo(
    () => ({
      playhead: playheadRef,
      cap: capRef,
      overlay: containerRef,
      scrollContainer: scrollContainerRef,
      rulerTrack: rulerTrackRef,
    }),
    [scrollContainerRef, rulerTrackRef],
  );
  const phases = useMemo(
    () => ({ read: () => readPlayheadFrame(frame, elements), write: () => writePlayheadFrame(frame, elements) }),
    [frame, elements],
  );

  useFrameLoop(phases, "timeline-playhead");

  useEffect(() => {
    let yielded = false;

    const onMove = (e: MouseEvent) => {
      const playhead = playheadRef.current;
      if (!playhead) return;

      const playheadCenterXViewport = frame.containerLeft + frame.playheadCenterXLocal;
      const nearPlayhead =
        e.clientX >= playheadCenterXViewport - HIT_BUFFER_PX && e.clientX <= playheadCenterXViewport + HIT_BUFFER_PX;

      if (!nearPlayhead) {
        if (yielded) {
          yielded = false;
          playhead.classList.remove("playhead-yield");
        }
        return;
      }

      const stack = document.elementsFromPoint(e.clientX, e.clientY);
      const overWord = stack.some(
        (el) =>
          el instanceof HTMLElement && el !== playhead && !playhead.contains(el) && el.closest("[data-word-block]"),
      );

      if (overWord !== yielded) {
        yielded = overWord;
        playhead.classList.toggle("playhead-yield", overWord);
      }
    };

    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, [frame]);

  const drag = useMemo(
    () =>
      createPlayheadDrag({
        getContainerRect: () => containerRef.current?.getBoundingClientRect(),
        getScrollContainer: () => scrollContainerRef.current,
        getDuration: () => duration,
        getZoom: () => useTimelineStore.getState().zoom,
        getCurrentTime: livePlaybackTime,
        setIsPlaying,
        setDraggingPlayhead,
        setDragTime,
        seekTo,
        snapTime: (t, bypass) => snapPlayheadTime(t, bypass),
      }),
    [duration, seekTo, setIsPlaying, setDraggingPlayhead, setDragTime, scrollContainerRef],
  );

  useEffect(() => drag.dispose, [drag]);

  // A ruler press seeks there; moving while held keeps dragging the playhead. A plain click never pauses playback.
  useEffect(() => {
    if (!capHost) return;
    const listening = new AbortController();
    const { signal } = listening;
    let pressX: number | null = null;
    const onDown = (down: MouseEvent) => {
      if (down.button !== 0 || down.altKey || useTimelineStore.getState().markerMode) return;
      if (down.target instanceof Element && down.target.closest(".timeline-playhead-cap")) return;
      pressX = down.clientX;
    };
    const onMove = (move: MouseEvent) => {
      if (pressX === null || Math.abs(move.clientX - pressX) < RULER_DRAG_THRESHOLD_PX) return;
      pressX = null;
      drag.onMouseDown(move, true);
    };
    capHost.addEventListener("mousedown", onDown, { signal });
    document.addEventListener("mousemove", onMove, { signal });
    document.addEventListener("mouseup", () => (pressX = null), { signal });
    return () => listening.abort();
  }, [capHost, drag]);

  if (duration === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden z-50"
      style={{ clipPath: `inset(0 0 0 ${GUTTER_WIDTH}px)` }}
    >
      <CueFlash scrollContainerRef={scrollContainerRef} />
      <div
        ref={playheadRef}
        role="separator"
        aria-label="Playhead"
        data-guide-spot="playhead"
        data-guide-spot-clear="[data-overview-band]"
        aria-orientation="vertical"
        className="timeline-playhead-bar absolute top-0 left-0 w-0.5 rounded-b-[1px] bg-composer-accent cursor-ew-resize pointer-events-auto expanded-hit-x-sm"
        style={{ height: containerHeight }}
        onMouseDown={drag.onMouseDown}
      />
      {capHost && createPortal(<PlayheadCap ref={capRef} onMouseDown={drag.onMouseDown} />, capHost)}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelinePlayhead };
