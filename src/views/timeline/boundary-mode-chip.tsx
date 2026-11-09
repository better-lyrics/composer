import { noteGuideSignal } from "@/lib/guide-signals";
import { useGuideStore } from "@/stores/guide";
import { useSettingsStore } from "@/stores/settings";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { cn } from "@/utils/cn";
import { guideChipVariants, guideIconSwapVariants } from "@/utils/animationVariants";
import { IconLink, IconUnlink } from "@tabler/icons-react";
import { AnimatePresence, MotionConfig, m } from "motion/react";
import { useEffect, useSyncExternalStore } from "react";
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

// -- State --------------------------------------------------------------------

// One chip for the whole Timeline: only one boundary drag runs at a time, so word tracks share this owner.
let place: ChipPlace | null = null;
let altDown = false;
const listeners = new Set<() => void>();

// -- Helpers ------------------------------------------------------------------

function notify(): void {
  for (const listener of listeners) listener();
}

function setPlace(next: ChipPlace | null): void {
  if (next === place) return;
  place = next;
  notify();
}

// Once you have opened a gap with Alt, you know it: the chip never shows again.
function chipStillTeaching(): boolean {
  return useSettingsStore.getState().showGuide && !useGuideStore.getState().learnedSignals.includes(ALT_GAP_SIGNAL);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => place;
const noPlace = () => null;
const altSnapshot = () => altDown;

// -- API ----------------------------------------------------------------------

// Teaches the Alt gap during the drag itself. Placed once at drag start; it never follows the pointer.
function beginBoundaryDrag(track: HTMLElement, clientX: number, edgeKey: string): void {
  if (!chipStillTeaching()) return;
  setPlace({ x: clientX, y: track.getBoundingClientRect().top - CHIP_LIFT_PX, edgeKey });
}

function endBoundaryDrag(finished: { edgeKey: string; gapOpen: boolean } | null): void {
  setPlace(null);
  if (!finished) return;
  noteGuideSignal(finished.gapOpen ? ALT_GAP_SIGNAL : "timeline.syllablesMovedTogether", finished.edgeKey);
}

// -- Hooks --------------------------------------------------------------------

// Alt is often pressed before the drag starts, so the key is tracked all along and only re-renders while the chip shows.
function useAltHeld(): boolean {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (altDown === event.altKey) return;
      altDown = event.altKey;
      if (place) notify();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keyup", onKey);
    };
  }, []);
  return useSyncExternalStore(subscribe, altSnapshot, altSnapshot);
}

// -- Components ---------------------------------------------------------------

const ChipBody: React.FC<{ gapOpen: boolean }> = ({ gapOpen }) => (
  <>
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
      <InlineKeyBadge keys={["Alt"]} className="ml-0" />
      {gapOpen ? "to join" : "to split"}
    </span>
  </>
);

const BoundaryModeChip: React.FC = () => {
  const shown = useSyncExternalStore(subscribe, snapshot, noPlace);
  const gapOpen = useAltHeld();
  if (typeof document === "undefined") return null;
  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {shown && (
          <m.div
            key={shown.edgeKey}
            variants={guideChipVariants}
            initial="hidden"
            animate="shown"
            exit="exit"
            style={{ left: shown.x, top: shown.y }}
            className="surface-floating layer-floating pointer-events-none fixed flex h-8 -translate-x-1/2 items-center gap-2 rounded-full border border-transparent pr-3 pl-1.5 text-xs whitespace-nowrap select-none"
          >
            <ChipBody gapOpen={gapOpen} />
          </m.div>
        )}
      </AnimatePresence>
    </MotionConfig>,
    document.body,
  );
};

// -- Exports ------------------------------------------------------------------

export { BoundaryModeChip, beginBoundaryDrag, endBoundaryDrag };
