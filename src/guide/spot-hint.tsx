import { useEscapeLayerStackStore } from "@/stores/escape-layer-stack";
import type { Icon } from "@tabler/icons-react";
import { guideChipVariants } from "@/utils/animationVariants";
import { cn } from "@/utils/cn";
import { AnimatePresence, MotionConfig, m } from "motion/react";
import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// -- Types --------------------------------------------------------------------

interface SpotHintContent {
  id: string;
  icon: Icon;
  text: React.ReactNode;
}

interface ShownSpotHint extends SpotHintContent {
  x: number;
  y: number;
  below: boolean;
  fromRight: boolean;
}

// -- Constants ----------------------------------------------------------------

const SPOT_HINT_VISIBLE_MS = 6_000;
const SPOT_GAP_PX = 10;
// Anchors near the top of the window take their hint below, everything else above.
const BELOW_WHEN_TOP_UNDER_PX = 220;

// -- State --------------------------------------------------------------------

let shown: ShownSpotHint | null = null;
let shownAnchor: Element | null = null;
const listeners = new Set<() => void>();

// -- Helpers ------------------------------------------------------------------

function setShown(next: ShownSpotHint | null): void {
  shown = next;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => shown;
const nothing = () => null;

// -- API ----------------------------------------------------------------------

// Shows a hint next to the control or spot it is about. Returns false when the spot is not on screen.
function showSpotHint(spot: string, content: SpotHintContent): boolean {
  const anchor = document.querySelector(`[data-guide-spot="${spot}"]`);
  if (!anchor) return false;
  const rect = anchor.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  // Off screen, under an open dialog or behind another hint, the orb carries it instead.
  const onScreen = rect.right > 0 && rect.left < window.innerWidth && rect.bottom > 0 && rect.top < window.innerHeight;
  if (!onScreen || shown || useEscapeLayerStackStore.getState().layers.length > 0) return false;
  // An anchor can name an area its hint must not cover, such as the waveform under the playhead.
  const clearSelector = anchor.getAttribute("data-guide-spot-clear");
  const clearBottom = clearSelector ? document.querySelector(clearSelector)?.getBoundingClientRect().bottom : undefined;
  const below = rect.top < BELOW_WHEN_TOP_UNDER_PX;
  const y = below
    ? Math.max(Math.min(rect.bottom, rect.top + 48), clearBottom ?? 0) + SPOT_GAP_PX
    : rect.top - SPOT_GAP_PX;
  // The hint lines up with the anchor's outer edge, so it never runs off the side of the window.
  const fromRight = rect.left + rect.width / 2 > window.innerWidth / 2;
  shownAnchor = anchor;
  setShown({ ...content, x: fromRight ? rect.right : rect.left, y, below, fromRight });
  return true;
}

function hideSpotHint(): void {
  shownAnchor = null;
  if (shown) setShown(null);
}

// Using the control the hint is about keeps it up; a press anywhere else puts it away.
function hideOnPressElsewhere(event: PointerEvent): void {
  if (!(event.target instanceof Node && shownAnchor?.contains(event.target))) hideSpotHint();
}

// -- Components ---------------------------------------------------------------

const SpotHint: React.FC = () => {
  const hint = useSyncExternalStore(subscribe, snapshot, nothing);
  const hintId = hint?.id;
  useEffect(() => {
    if (!hintId) return;
    const timer = window.setTimeout(hideSpotHint, SPOT_HINT_VISIBLE_MS);
    window.addEventListener("pointerdown", hideOnPressElsewhere, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", hideOnPressElsewhere, true);
    };
  }, [hintId]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {hint && (
          <m.div
            key={hint.id}
            role="status"
            variants={guideChipVariants}
            initial="hidden"
            animate="shown"
            exit="exit"
            style={{ left: hint.x, top: hint.y }}
            className={cn(
              "surface-floating layer-floating pointer-events-none fixed flex h-8 max-w-[min(420px,calc(100vw-2rem))] items-center gap-2 rounded-full border border-transparent px-2.5 text-xs whitespace-nowrap select-none",
              hint.fromRight && "-translate-x-full",
              !hint.below && "-translate-y-full",
            )}
          >
            <hint.icon className="size-4 shrink-0 text-composer-accent-text" stroke={1.75} />
            <span className="truncate">{hint.text}</span>
          </m.div>
        )}
      </AnimatePresence>
    </MotionConfig>,
    document.body,
  );
};

// -- Exports ------------------------------------------------------------------

export { SpotHint, showSpotHint };
