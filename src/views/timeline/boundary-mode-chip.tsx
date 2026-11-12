import { useAltHeld } from "@/views/timeline/alt-key-held";
import { boundaryChipSnapshot, subscribeBoundaryChip } from "@/views/timeline/boundary-chip-store";
import { MotionFloatingChip } from "@/ui/floating-chip";
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

const ChipIcon: React.FC<{ gapOpen: boolean }> = ({ gapOpen }) => (
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
);

const ChipBody: React.FC<{ gapOpen: boolean }> = ({ gapOpen }) => (
  <>
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
          <MotionFloatingChip
            key={shown.edgeKey}
            variants={guideChipVariants}
            initial="hidden"
            animate="shown"
            exit="exit"
            style={{ left: shown.x, top: shown.y }}
            icon={<ChipIcon gapOpen={gapOpen} />}
            className="-translate-x-1/2"
          >
            <ChipBody gapOpen={gapOpen} />
          </MotionFloatingChip>
        )}
      </AnimatePresence>
    </MotionConfig>,
    document.body,
  );
};

// -- Exports ------------------------------------------------------------------

export { BoundaryModeChip };
