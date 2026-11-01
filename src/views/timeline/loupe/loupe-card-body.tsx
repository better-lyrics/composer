import { effectiveTrackWords, getEffectiveLines } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import type { LoupeSize } from "@/domain/spectrum/loupe-size";
import { useProjectStore } from "@/stores/project";
import { loupeDeltaPopVariants } from "@/utils/animationVariants";
import { cn } from "@/utils/cn";
import { formatTime } from "@/utils/format-time";
import { LOUPE_ZOOM } from "@/views/timeline/loupe/draw-loupe";
import { LoupeSpectrum } from "@/views/timeline/loupe/loupe-spectrum";
import type { LoupeTarget } from "@/views/timeline/loupe/loupe-target";
import { pitchSession } from "@/views/timeline/pitch/pitch-session";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { IconMicrophone2 } from "@tabler/icons-react";
import { m, useReducedMotion } from "motion/react";

// -- Types --------------------------------------------------------------------

interface LoupeCardBodyProps {
  target: LoupeTarget;
  size: LoupeSize;
  children?: React.ReactNode;
}

// -- Constants ----------------------------------------------------------------

const LOUPE_CARD_SURFACE =
  "px-1.5 pb-1.5 rounded-2xl bg-composer-bg-elevated shadow-[inset_0_0_0_1px_var(--edge),inset_0_1px_0_var(--highlight),0_22px_48px_-14px_rgb(var(--shade)/0.7)]";

// -- Helpers ------------------------------------------------------------------

function editedWordText(lines: readonly LyricLine[], target: LoupeTarget): string {
  const line = lines.find((candidate) => candidate.id === target.lineId);
  if (!line) return "";
  const [effective] = getEffectiveLines([line]);
  return effectiveTrackWords(effective, target.track)?.[target.wordIndex]?.text.trim() ?? "";
}

function deltaLabel(deltaMs: number): string {
  if (deltaMs === 0) return "No change";
  return `${deltaMs > 0 ? "+" : "−"}${Math.abs(deltaMs)} ms`;
}

// -- Component ----------------------------------------------------------------

const LoupeCardBody: React.FC<LoupeCardBodyProps> = ({ target, size, children }) => {
  const reducedMotion = useReducedMotion();
  const word = useProjectStore((s) => editedWordText(s.lines, target));
  const hasPitch = useTimelineStore(() => pitchSession.track !== null);
  const deltaMs = Math.round((target.time - target.startTime) * 1000);

  return (
    <>
      <div className="h-8 flex items-center gap-1.5 pl-1.5 pr-1 text-xs text-(--muted) whitespace-nowrap">
        <span>{target.edge === "begin" ? "Start of" : "End of"}</span>
        <b className="max-w-[120px] truncate font-semibold text-composer-text">{word}</b>
        <span className="ml-1 font-mono text-[11px] font-medium tabular-nums text-(--label)">
          {formatTime(target.time)}
        </span>
        <span className="flex-1" />
        <m.span
          key={target.settledAt ?? "live"}
          variants={loupeDeltaPopVariants}
          initial="rest"
          animate={target.settledAt !== null && !reducedMotion ? "pop" : "rest"}
          className={cn(
            "h-5 px-1.5 inline-flex items-center rounded-md font-mono text-[11px] font-medium tabular-nums",
            deltaMs === 0
              ? "text-(--muted) bg-(--layer-2)"
              : "text-composer-accent-text bg-[color-mix(in_oklab,var(--color-composer-accent)_14%,transparent)]",
          )}
        >
          {deltaLabel(deltaMs)}
        </m.span>
        <span className="pl-1 font-mono text-[11px] font-medium tabular-nums">{LOUPE_ZOOM}x</span>
      </div>
      <LoupeSpectrum target={target} size={size} />
      {!hasPitch && (
        <div className="flex items-center gap-1.5 px-1.5 pt-2 pb-0.5 text-[11.5px] text-(--muted)">
          <IconMicrophone2 size={14} />
          Separate vocals to see pitch
        </div>
      )}
      {children}
    </>
  );
};

// -- Exports ------------------------------------------------------------------

export { LOUPE_CARD_SURFACE, LoupeCardBody };
