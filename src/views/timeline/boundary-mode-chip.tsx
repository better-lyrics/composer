import { noteGuideSignal } from "@/lib/guide-signals";
import { useGuideStore } from "@/stores/guide";
import { useSettingsStore } from "@/stores/settings";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { cn } from "@/utils/cn";
import { guideChipVariants, guideIconSwapVariants } from "@/utils/animationVariants";
import { ALT_KEY } from "@/utils/platform";
import { IconLink, IconUnlink } from "@tabler/icons-react";
import { AnimatePresence, MotionConfig, m } from "motion/react";
import { useCallback, useState } from "react";
import { createPortal } from "react-dom";

// -- Types --------------------------------------------------------------------

interface ChipPlace {
  x: number;
  y: number;
  edgeKey: string;
}

// -- Constants ----------------------------------------------------------------

const ALT_GAP_SIGNAL = "timeline.gap";
const CHIP_LIFT_PX = 40;
const DRAGS_AFTER_LEARNING = 3;

// -- State --------------------------------------------------------------------

let altGapsThisSession = 0;

// -- Helpers ------------------------------------------------------------------

function chipStillTeaching(): boolean {
  if (!useSettingsStore.getState().showGuide) return false;
  return !useGuideStore.getState().learnedSignals.includes(ALT_GAP_SIGNAL) || altGapsThisSession < DRAGS_AFTER_LEARNING;
}

// -- Hook ---------------------------------------------------------------------

// Teaches the Alt gap during the drag itself. Placed once at drag start; it never follows the pointer.
function useBoundaryModeChip() {
  const [place, setPlace] = useState<ChipPlace | null>(null);

  const beginBoundaryDrag = useCallback((track: HTMLElement, clientX: number, edgeKey: string) => {
    if (!chipStillTeaching()) return;
    setPlace({ x: clientX, y: track.getBoundingClientRect().top - CHIP_LIFT_PX, edgeKey });
  }, []);

  const endBoundaryDrag = useCallback((finished: { edgeKey: string; gapOpen: boolean } | null) => {
    setPlace(null);
    if (!finished) return;
    if (finished.gapOpen) altGapsThisSession += 1;
    noteGuideSignal(finished.gapOpen ? ALT_GAP_SIGNAL : "timeline.syllablesMovedTogether", finished.edgeKey);
  }, []);

  return { chipPlace: place, beginBoundaryDrag, endBoundaryDrag };
}

// -- Component ----------------------------------------------------------------

const BoundaryModeChip: React.FC<{ place: ChipPlace | null; gapOpen: boolean }> = ({ place, gapOpen }) =>
  typeof document !== "undefined" &&
  createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {place && (
          <m.div
            key={place.edgeKey}
            variants={guideChipVariants}
            initial="hidden"
            animate="shown"
            exit="exit"
            style={{ left: place.x, top: place.y }}
            className="surface-floating layer-floating pointer-events-none fixed flex h-8 -translate-x-1/2 items-center gap-2 rounded-full border border-transparent pr-3 pl-1.5 text-xs whitespace-nowrap select-none"
          >
            <span className="relative flex size-5 items-center justify-center rounded-full bg-(--layer-2)">
              <AnimatePresence initial={false} mode="popLayout">
                <m.span
                  key={gapOpen ? "gap" : "together"}
                  variants={guideIconSwapVariants}
                  initial="hidden"
                  animate="shown"
                  exit="hidden"
                  className="flex"
                >
                  {gapOpen ? (
                    <IconUnlink className="size-3.5 text-composer-accent-text" stroke={2} />
                  ) : (
                    <IconLink className="size-3.5" stroke={2} />
                  )}
                </m.span>
              </AnimatePresence>
            </span>
            <span className={cn("font-medium", gapOpen && "text-composer-accent-text")}>
              {gapOpen ? "Gap open" : "Moving together"}
            </span>
            <span aria-hidden className="h-3 w-px bg-composer-border" />
            <span className="flex items-center gap-1 text-(--muted)">
              {gapOpen ? "Release" : "Hold"}
              <InlineKeyBadge keys={[ALT_KEY]} />
              {gapOpen ? "to join" : "to split"}
            </span>
          </m.div>
        )}
      </AnimatePresence>
    </MotionConfig>,
    document.body,
  );

// -- Exports ------------------------------------------------------------------

export { BoundaryModeChip, useBoundaryModeChip };
