import { effectiveTrackWords, getEffectiveLines } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import { useFrameLoop } from "@/hooks/use-frame-loop";
import { useProjectStore } from "@/stores/project";
import { loupeDeltaPopVariants, loupeReducedVariants, loupeVariants } from "@/utils/animationVariants";
import { cn } from "@/utils/cn";
import { formatTime } from "@/utils/format-time";
import { LOUPE_ZOOM } from "@/views/timeline/loupe/draw-loupe";
import { LoupeSpectrum } from "@/views/timeline/loupe/loupe-spectrum";
import type { LoupeTarget } from "@/views/timeline/loupe/loupe-target";
import { placeLoupe } from "@/views/timeline/loupe/place-loupe";
import { pitchSession } from "@/views/timeline/pitch/pitch-session";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { FloatingPortal } from "@floating-ui/react";
import { IconMicrophone2 } from "@tabler/icons-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { type RefObject, useCallback, useLayoutEffect, useRef } from "react";

// -- Types --------------------------------------------------------------------

interface EditLoupeProps {
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}

interface LoupeCardProps extends EditLoupeProps {
  target: LoupeTarget;
}

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

// Positions are DOM writes from the frame loop, so the card follows scrolling without re-rendering.
function placeCard(card: HTMLDivElement, container: HTMLElement, target: LoupeTarget): void {
  const key = `${target.lineId}-${target.track}-${target.wordIndex}`;
  const block = container.querySelector<HTMLElement>(`[data-word-block][id="${CSS.escape(key)}"]`);
  const lane = block?.parentElement;
  if (!block || !lane) {
    card.style.visibility = "hidden";
    return;
  }
  const blockRect = block.getBoundingClientRect();
  const placement = placeLoupe({
    anchorX: target.edge === "begin" ? blockRect.left : blockRect.right,
    lane: lane.getBoundingClientRect(),
    bounds: container.getBoundingClientRect(),
    size: { width: card.offsetWidth, height: card.offsetHeight },
  });
  card.style.visibility = "";
  card.style.translate = `${Math.round(placement.left)}px ${Math.round(placement.top)}px`;
  card.style.setProperty("--tail-x", `${placement.tailX}px`);
  card.dataset.side = placement.side;
}

// -- Components ---------------------------------------------------------------

const LoupeCard: React.FC<LoupeCardProps> = ({ target, scrollContainerRef }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const word = useProjectStore((s) => editedWordText(s.lines, target));
  const hasPitch = useTimelineStore(() => pitchSession.track !== null);
  const deltaMs = Math.round((target.time - target.startTime) * 1000);

  const place = useCallback(() => {
    const card = cardRef.current;
    const container = scrollContainerRef.current;
    if (card && container) placeCard(card, container, target);
  }, [target, scrollContainerRef]);
  useLayoutEffect(place, [place]);
  useFrameLoop(place, "edit loupe placement");

  return (
    <div
      ref={cardRef}
      aria-hidden="true"
      className="group fixed top-0 left-0 layer-floating pointer-events-none select-none"
    >
      <m.div
        variants={reducedMotion ? loupeReducedVariants : loupeVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative w-[440px] px-1.5 pb-1.5 rounded-2xl bg-composer-bg-elevated shadow-[inset_0_0_0_1px_var(--edge),inset_0_1px_0_var(--highlight),0_22px_48px_-14px_rgb(var(--shade)/0.7)] origin-[var(--tail-x)_100%] group-data-[side=below]:origin-[var(--tail-x)_0]"
      >
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
        <LoupeSpectrum target={target} />
        {!hasPitch && (
          <div className="flex items-center gap-1.5 px-1.5 pt-2 pb-0.5 text-[11.5px] text-(--muted)">
            <IconMicrophone2 size={14} />
            Separate vocals to see pitch
          </div>
        )}
        <i className="absolute left-[calc(var(--tail-x)-6px)] size-3 rotate-45 bg-composer-bg-elevated -bottom-1.5 shadow-[inset_-1px_-1px_0_var(--edge)] group-data-[side=below]:bottom-auto group-data-[side=below]:-top-1.5 group-data-[side=below]:shadow-[inset_1px_1px_0_var(--edge)]" />
      </m.div>
    </div>
  );
};

// Gated on the spectrum: for ordinary syncing the loupe is noise.
const EditLoupe: React.FC<EditLoupeProps> = ({ scrollContainerRef }) => {
  const spectrumVisible = useTimelineStore((s) => s.spectrumVisible);
  const target = useTimelineStore((s) => s.loupeTarget);
  return (
    <FloatingPortal>
      <AnimatePresence>
        {spectrumVisible && target && (
          <LoupeCard key="edit-loupe" target={target} scrollContainerRef={scrollContainerRef} />
        )}
      </AnimatePresence>
    </FloatingPortal>
  );
};

// -- Exports ------------------------------------------------------------------

export { EditLoupe };
