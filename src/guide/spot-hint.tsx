import { hideOnPressElsewhere, hideSpotHint, spotHintSnapshot, subscribeSpotHint } from "@/guide/spot-hint-store";
import { guideChipVariants } from "@/utils/animationVariants";
import { cn } from "@/utils/cn";
import { AnimatePresence, MotionConfig, m } from "motion/react";
import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// -- Constants ----------------------------------------------------------------

const SPOT_HINT_VISIBLE_MS = 6_000;
const nothing = () => null;

// -- Components ---------------------------------------------------------------

const SpotHint: React.FC = () => {
  const hint = useSyncExternalStore(subscribeSpotHint, spotHintSnapshot, nothing);
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

export { SpotHint };
