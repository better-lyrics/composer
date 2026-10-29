import { LOUPE_FIXED, type LoupeSize, clampLoupeSize, fitLoupeSize } from "@/domain/spectrum/loupe-size";
import { useFrameLoop } from "@/hooks/use-frame-loop";
import { useSettingsStore } from "@/stores/settings";
import { loupeReducedVariants, loupeVariants } from "@/utils/animationVariants";
import { cn } from "@/utils/cn";
import { loupeCanvas } from "@/views/timeline/loupe/draw-loupe";
import { LOUPE_CARD_SURFACE, LoupeCardBody } from "@/views/timeline/loupe/loupe-card-body";
import type { LoupeTarget } from "@/views/timeline/loupe/loupe-target";
import { placeLoupe } from "@/views/timeline/loupe/place-loupe";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { FloatingPortal } from "@floating-ui/react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { type RefObject, useCallback, useLayoutEffect, useMemo, useRef } from "react";

// -- Types --------------------------------------------------------------------

interface EditLoupeProps {
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}

interface LoupeCardProps extends EditLoupeProps {
  target: LoupeTarget;
}

// -- Helpers ------------------------------------------------------------------

// Positions are DOM writes from the frame loop, so the card follows scrolling without re-rendering.
function placeCard(card: HTMLDivElement, container: HTMLElement, target: LoupeTarget, size: LoupeSize): void {
  if (card.firstElementChild instanceof HTMLElement) {
    card.firstElementChild.style.width = `${loupeCanvas(size).width + LOUPE_FIXED.cardX}px`;
  }
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
  const loupeWidth = useSettingsStore((s) => s.loupeWidth);
  const loupeHeight = useSettingsStore((s) => s.loupeHeight);
  const size = useMemo(
    () =>
      fitLoupeSize(
        clampLoupeSize({ width: loupeWidth, height: loupeHeight }),
        { width: window.innerWidth, height: window.innerHeight },
        LOUPE_FIXED.noteRowHeight,
      ),
    [loupeWidth, loupeHeight],
  );

  const place = useCallback(() => {
    const card = cardRef.current;
    const container = scrollContainerRef.current;
    if (card && container) placeCard(card, container, target, size);
  }, [target, scrollContainerRef, size]);
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
        className={cn(
          LOUPE_CARD_SURFACE,
          "relative origin-[var(--tail-x)_100%] group-data-[side=below]:origin-[var(--tail-x)_0]",
        )}
      >
        <LoupeCardBody target={target} size={size} />
        <i className="absolute left-[calc(var(--tail-x)-6px)] size-3 rotate-45 bg-composer-bg-elevated -bottom-1.5 shadow-[inset_-1px_-1px_0_var(--edge)] group-data-[side=below]:bottom-auto group-data-[side=below]:-top-1.5 group-data-[side=below]:shadow-[inset_1px_1px_0_var(--edge)]" />
      </m.div>
    </div>
  );
};

// Gated on the spectrum: for ordinary syncing the loupe is noise.
const EditLoupe: React.FC<EditLoupeProps> = ({ scrollContainerRef }) => {
  const showSpectrum = useSettingsStore((s) => s.showSpectrum);
  const target = useTimelineStore((s) => s.loupeTarget);
  return (
    <FloatingPortal>
      <AnimatePresence>
        {showSpectrum && target && (
          <LoupeCard key="edit-loupe" target={target} scrollContainerRef={scrollContainerRef} />
        )}
      </AnimatePresence>
    </FloatingPortal>
  );
};

// -- Exports ------------------------------------------------------------------

export { EditLoupe };
