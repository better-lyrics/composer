import { useMemo } from "react";
import { cn } from "@/utils/cn";
import { hashTint, TINT_BG, TINT_COLOR } from "@/utils/library/hash-tint";
import { synthPeaks } from "@/utils/library/synth-peaks";

// -- Interfaces ---------------------------------------------------------------

interface WaveformFallbackProps {
  seed: string;
  peaks?: number[];
  className?: string;
}

// -- Constants ----------------------------------------------------------------

const VIEW = 200;
const STEPS = 64;
const MARGIN = 18;

// -- Path builder -------------------------------------------------------------

interface Point {
  x: number;
  y: number;
}

function buildPath(peaks: number[]): string {
  const halfHeight = VIEW / 2 - MARGIN;
  const points: Point[] = peaks.map((peak, i) => {
    const t = peaks.length === 1 ? 0.5 : i / (peaks.length - 1);
    return { x: t * VIEW, y: VIEW / 2 - peak * halfHeight };
  });

  let top = `M 0 ${VIEW / 2}`;
  for (let i = 0; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    top += ` Q ${points[i].x} ${points[i].y} ${xc} ${yc}`;
  }
  top += ` L ${VIEW} ${VIEW / 2}`;

  let bottom = "";
  for (let i = points.length - 1; i >= 0; i--) {
    const mx = points[i].x;
    const my = VIEW - points[i].y;
    if (i === points.length - 1) {
      bottom += `L ${mx} ${my}`;
    } else {
      const next = points[i + 1];
      const xc = (next.x + mx) / 2;
      const yc = (VIEW - next.y + my) / 2;
      bottom += ` Q ${next.x} ${VIEW - next.y} ${xc} ${yc}`;
    }
  }
  bottom += ` L 0 ${VIEW / 2} Z`;

  return `${top} ${bottom}`;
}

// -- Component ----------------------------------------------------------------

const WaveformFallback: React.FC<WaveformFallbackProps> = ({ seed, peaks, className }) => {
  const tint = hashTint(seed);
  const resolvedPeaks = useMemo(() => (peaks && peaks.length > 0 ? peaks : synthPeaks(seed, STEPS)), [peaks, seed]);
  const pathD = useMemo(() => buildPath(resolvedPeaks), [resolvedPeaks]);

  return (
    <svg
      className={cn("block size-full", className)}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      data-tint={tint}
      role="img"
      aria-label="Waveform"
    >
      <rect width={VIEW} height={VIEW} fill={TINT_BG[tint]} />
      <path d={pathD} fill={TINT_COLOR[tint]} />
    </svg>
  );
};

// -- Exports ------------------------------------------------------------------

export { WaveformFallback };
