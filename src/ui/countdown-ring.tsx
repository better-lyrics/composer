import { useFrameLoop } from "@/hooks/use-frame-loop";
import { holdFrames } from "@/lib/frame-loop";
import { formatCountdown } from "@/utils/format-countdown";
import { useEffect, useRef, useState } from "react";

// -- Interfaces ---------------------------------------------------------------

interface CountdownRingProps {
  remainingSeconds: () => number;
  totalSeconds: number;
  precision: 0 | 1;
  announce: (wholeSeconds: number) => string;
}

// -- Constants ----------------------------------------------------------------

const SIZE = 26;
const STROKE = 2.5;
const RADIUS = (SIZE - STROKE) / 2 - 0.25;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// -- Helpers ------------------------------------------------------------------

function arcOffset(remaining: number, total: number): number {
  if (total <= 0) return 0;
  return CIRCUMFERENCE * Math.min(1, Math.max(0, remaining / total));
}

function wholeSecondsLeft(remaining: number): number {
  return Number(formatCountdown(remaining, 0));
}

// -- Components ---------------------------------------------------------------

const CountdownRing: React.FC<CountdownRingProps> = ({ remainingSeconds, totalSeconds, precision, announce }) => {
  const arcRef = useRef<SVGCircleElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const [initial] = useState(remainingSeconds);

  useEffect(() => holdFrames("countdown ring"), []);

  useFrameLoop(() => {
    const remaining = remainingSeconds();
    arcRef.current?.setAttribute("stroke-dashoffset", String(arcOffset(remaining, totalSeconds)));
    const label = formatCountdown(remaining, precision);
    if (labelRef.current && labelRef.current.textContent !== label) labelRef.current.textContent = label;
    const announcement = announce(wholeSecondsLeft(remaining));
    if (statusRef.current && statusRef.current.textContent !== announcement) {
      statusRef.current.textContent = announcement;
    }
  }, "countdown ring");

  return (
    <span className="relative inline-flex size-6.5 shrink-0 items-center justify-center select-none">
      <svg width={SIZE} height={SIZE} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-composer-bg-elevated"
        />
        <circle
          ref={arcRef}
          data-countdown-arc=""
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={arcOffset(initial, totalSeconds)}
          className="stroke-composer-accent"
        />
      </svg>
      <span
        ref={labelRef}
        aria-hidden="true"
        className="relative font-mono text-[10px] leading-none font-medium tracking-tighter tabular-nums text-composer-text"
      >
        {formatCountdown(initial, precision)}
      </span>
      <span ref={statusRef} role="status" aria-atomic="true" className="sr-only" />
    </span>
  );
};

// -- Exports ------------------------------------------------------------------

export { CountdownRing };
