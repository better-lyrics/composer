import { useAltHeld } from "@/views/timeline/alt-key-held";
import { boundaryChipSnapshot, subscribeBoundaryChip } from "@/views/timeline/boundary-chip-store";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { cn } from "@/utils/cn";
import { guideChipVariants, guideIconSwapVariants } from "@/utils/animationVariants";
import { IconLink, IconUnlink } from "@tabler/icons-react";
import { AnimatePresence, MotionConfig, m } from "motion/react";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// -- Constants ----------------------------------------------------------------

const noPlace = () => null;

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
  const shown = useSyncExternalStore(subscribeBoundaryChip, boundaryChipSnapshot, noPlace);
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

export { BoundaryModeChip };
