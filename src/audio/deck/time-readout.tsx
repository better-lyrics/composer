import { lineStarts, startedLineIndex } from "@/domain/line/line-at-time";
import { useFrameLoop } from "@/hooks/use-frame-loop";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { formatTime } from "@/utils/format-time";
import { useLayoutEffect, useMemo, useRef } from "react";

// -- Helpers ------------------------------------------------------------------

function writeText(element: HTMLElement | null, text: string): void {
  if (element && element.textContent !== text) element.textContent = text;
}

// -- Component ----------------------------------------------------------------

const TimeReadout: React.FC = () => {
  const duration = useAudioStore((state) => state.duration);
  const lines = useProjectStore((state) => state.lines);
  const starts = useMemo(() => lineStarts(lines), [lines]);
  const wholeRef = useRef<HTMLSpanElement>(null);
  const fractionRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);

  const paint = () => {
    const time = livePlaybackTime();
    const [whole, fraction] = formatTime(time, 2).split(".");
    writeText(wholeRef.current, whole);
    writeText(fractionRef.current, `.${fraction}`);
    writeText(lineRef.current, `${startedLineIndex(starts, time) + 1}`);
  };

  // The spans have no React children: the frame loop owns their text, and this paints them once before it wakes.
  useLayoutEffect(paint);
  useFrameLoop(paint, "deck-time-readout");

  return (
    <div className="display-scanlines grid content-center gap-1 h-14 min-w-[196px] px-3.5 rounded-xl bg-(--display) shadow-(--well-edge) font-mono tabular-nums">
      <div className="flex items-baseline font-semibold text-2xl leading-none tracking-[-0.02em] text-composer-accent-text select-text cursor-text">
        <span ref={wholeRef} />
        <span
          ref={fractionRef}
          className="text-base text-[color-mix(in_oklab,var(--color-composer-accent-text)_55%,transparent)]"
        />
      </div>
      <div className="flex items-baseline justify-between gap-3 text-[11px] leading-none text-composer-text-faint">
        {lines.length > 0 && (
          <span>
            Line{" "}
            <span
              ref={lineRef}
              className="text-[color-mix(in_oklab,var(--color-composer-accent-text)_70%,transparent)]"
            />{" "}
            of {starts.length}
          </span>
        )}
        <span className="ml-auto select-text cursor-text">/ {formatTime(duration, 2)}</span>
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { TimeReadout };
