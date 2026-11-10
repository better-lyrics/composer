import { PEEK_ICONS, PEEK_LABELS, PEEK_TONES, type GuidePeek } from "@/ui/guide/peek";
import { ProgressRing } from "@/ui/guide/progress-ring";
import { cn } from "@/utils/cn";
import {
  guideBadgeVariants,
  guideIconSwapVariants,
  guidePeekTextVariants,
  guideSpring,
} from "@/utils/animationVariants";
import { IconChevronDown, IconCompass } from "@tabler/icons-react";
import { AnimatePresence, m } from "motion/react";

// -- Types --------------------------------------------------------------------

interface GuideOrbProps {
  peek: GuidePeek | null;
  unread: number;
  progress: number;
  open: boolean;
  onClick: () => void;
  onHold: () => void;
  onRelease: () => void;
}

// -- Constants ----------------------------------------------------------------

// -- Components ---------------------------------------------------------------

const orbLabel = (unread: number) => (unread > 0 ? `Open guide, ${unread} new` : "Open guide");

const GuideOrb: React.FC<GuideOrbProps> = ({ peek, unread, progress, open, onClick, onHold, onRelease }) => {
  const showPeek = peek !== null && !open;
  const PeekIcon = showPeek ? PEEK_ICONS[peek.kind] : IconCompass;
  const showCount = !showPeek && !open && unread > 0;
  return (
    <div className="relative">
      <m.button
        layout
        type="button"
        transition={guideSpring}
        onClick={onClick}
        onPointerEnter={onHold}
        onPointerLeave={onRelease}
        onFocus={onHold}
        onBlur={onRelease}
        aria-label={showPeek ? undefined : open ? "Close guide" : orbLabel(unread)}
        aria-expanded={open}
        className={cn(
          "surface-floating relative flex h-11 cursor-pointer select-none items-center overflow-hidden rounded-full border border-transparent p-1 text-[13px] transition-[scale] duration-150 ease-out active:scale-[0.96]",
          showCount && "orb-badge-gap",
        )}
      >
        <m.span layout="position" className="relative flex size-9 shrink-0 items-center justify-center">
          <ProgressRing progress={progress} className="absolute inset-0" />
          <AnimatePresence initial={false} mode="popLayout">
            <m.span
              key={open ? "open" : (peek?.kind ?? "rest")}
              variants={guideIconSwapVariants}
              initial="hidden"
              animate="shown"
              exit="hidden"
              className="flex"
            >
              {open ? (
                <IconChevronDown className="size-4 text-(--label)" />
              ) : (
                <PeekIcon className={cn("size-4", showPeek ? PEEK_TONES[peek.kind] : "text-(--label)")} stroke={1.75} />
              )}
            </m.span>
          </AnimatePresence>
        </m.span>
        <AnimatePresence initial={false} mode="popLayout">
          {showPeek && (
            <m.span
              key={peek.id}
              layout="position"
              variants={guidePeekTextVariants}
              initial="hidden"
              animate="shown"
              exit="exit"
              aria-live="polite"
              className="flex max-w-[min(520px,calc(100vw-8rem))] items-center gap-2 whitespace-nowrap pr-3.5 pl-1.5"
            >
              <span className={cn("font-semibold", PEEK_TONES[peek.kind])}>{PEEK_LABELS[peek.kind]}</span>
              <span className="min-w-0 truncate text-composer-text">{peek.gist}</span>
            </m.span>
          )}
        </AnimatePresence>
      </m.button>
      <AnimatePresence>
        {showCount && (
          <m.span
            key="count"
            variants={guideBadgeVariants}
            initial="hidden"
            animate="shown"
            exit="exit"
            aria-hidden
            className="pointer-events-none absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-composer-accent px-1 text-[11px] leading-none font-semibold text-composer-on-accent tabular-nums"
          >
            {unread}
          </m.span>
        )}
      </AnimatePresence>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { GuideOrb };
