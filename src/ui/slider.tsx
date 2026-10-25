import { cn } from "@/utils/cn";
import { useCallback, useRef } from "react";

// -- Types --------------------------------------------------------------------

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  "aria-label"?: string;
  className?: string;
  children?: React.ReactNode;
  // "overlay" draws nothing: the slider becomes an invisible control over a custom surface.
  appearance?: "track" | "overlay";
}

// -- Constants ----------------------------------------------------------------

// The fader cap stays inside the track, so its centre travels between half its width from each end.
const CAP_WIDTH_PX = 12;

// -- Helpers ------------------------------------------------------------------

function stepDecimals(step: number): number {
  const [, fraction = ""] = String(step).split(".");
  return fraction.length;
}

// Snaps to the step grid from min and clamps; rounding to the step's decimals drops float noise such as 0.30000000000000004.
function snapToStep(raw: number, min: number, max: number, step: number | undefined): number {
  const clamped = Math.max(min, Math.min(max, raw));
  if (!step) return clamped;
  const stepped = min + Math.round((clamped - min) / step) * step;
  return Math.max(min, Math.min(max, Number(stepped.toFixed(stepDecimals(step)))));
}

// -- Component ----------------------------------------------------------------

const Slider: React.FC<SliderProps> = ({
  value,
  min,
  max,
  step = 1,
  onChange,
  "aria-label": ariaLabel,
  className = "",
  children,
  appearance = "track",
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;

  const calculateValue = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return value;

      const rect = track.getBoundingClientRect();
      const inset = appearance === "track" ? CAP_WIDTH_PX / 2 : 0;
      const travel = Math.max(1, rect.width - 2 * inset);
      const x = Math.max(0, Math.min(clientX - rect.left - inset, travel));
      return snapToStep(min + (x / travel) * (max - min), min, max, step);
    },
    [min, max, step, value, appearance],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      isDraggingRef.current = true;
      onChange(calculateValue(e.clientX));
    },
    [calculateValue, onChange],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isDraggingRef.current) onChange(calculateValue(e.clientX));
    },
    [calculateValue, onChange],
  );

  const endDrag = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const largeStep = (max - min) * 0.1;
      const smallStep = step || (max - min) * 0.01;

      switch (e.key) {
        case "ArrowLeft":
        case "ArrowDown":
          e.preventDefault();
          onChange(snapToStep(value - smallStep, min, max, step));
          break;
        case "ArrowRight":
        case "ArrowUp":
          e.preventDefault();
          onChange(snapToStep(value + smallStep, min, max, step));
          break;
        case "PageDown":
          e.preventDefault();
          onChange(snapToStep(value - largeStep, min, max, step));
          break;
        case "PageUp":
          e.preventDefault();
          onChange(snapToStep(value + largeStep, min, max, step));
          break;
        case "Home":
          e.preventDefault();
          onChange(min);
          break;
        case "End":
          e.preventDefault();
          onChange(max);
          break;
      }
    },
    [min, max, step, value, onChange],
  );

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={ariaLabel}
      className={cn(
        appearance === "track"
          ? "group relative flex items-center h-[18px] touch-none cursor-pointer rounded-[5px] outline-none"
          : "relative touch-none cursor-pointer",
        className,
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
    >
      {children}
      {appearance === "track" && <SliderTrack percent={percent} />}
    </div>
  );
};

// The cap is a small twin of the timeline playhead cap, turned into a fader.
const SliderTrack: React.FC<{ percent: number }> = ({ percent }) => {
  const capLeft = `calc((100% - ${CAP_WIDTH_PX}px) * ${percent / 100})`;
  return (
    <>
      <div className="relative w-full h-1.5 rounded-full bg-(--well) shadow-(--well-edge)">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-composer-accent"
          style={{ width: `calc(${capLeft} + ${CAP_WIDTH_PX / 2}px)` }}
        />
      </div>
      <div
        className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center gap-0.5 w-3 h-[18px] rounded-[4px] bg-linear-to-b from-white to-[color-mix(in_oklab,white_86%,var(--color-composer-bg))] shadow-[0_1px_2px_rgb(0_0_0/0.4),inset_0_0_0_0.5px_rgb(0_0_0/0.12)] transition-[scale] duration-120 ease-[cubic-bezier(0.34,1.45,0.64,1)] group-active:scale-[0.88]"
        style={{ left: capLeft }}
      >
        <i className="block w-px h-2 rounded-[1px] bg-[color-mix(in_oklab,black_38%,transparent)]" />
        <i className="block w-px h-2 rounded-[1px] bg-[color-mix(in_oklab,black_38%,transparent)]" />
      </div>
    </>
  );
};

export { Slider };
