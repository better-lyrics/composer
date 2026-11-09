import { PEEK_ICONS, PEEK_LABELS, PEEK_TONES, type GuidePeek } from "@/ui/guide/peek";
import { cn } from "@/utils/cn";
import { guideBadgeVariants, guideIconSwapVariants, guidePeekTextVariants, guideSpring } from "@/utils/animationVariants";
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

const RING_RADIUS = 15;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

// -- Components ---------------------------------------------------------------

const ProgressRing: React.FC<{ progress: number }> = ({ progress }) => (
  <svg viewBox="0 0 36 36" className="absolute inset-0 size-9 -rotate-90" aria-hidden>
    <circle cx="18" cy="18" r={RING_RADIUS} fill="none" stroke="var(--layer-2)" strokeWidth="2" />
    <circle
      cx="18"
      cy="18"
      r={RING_RADIUS}
      fill="none"
      stroke="var(--color-composer-accent)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray={RING_LENGTH}
      strokeDashoffset={RING_LENGTH * (1 - progress)}
      className="transition-[stroke-dashoffset] duration-500 ease-out"
    />
  </svg>
);

const orbLabel = (unread: number) => (unread > 0 ? `Open guide, ${unread} new` : "Open guide");

const GuideOrb: React.FC<GuideOrbProps> = ({ peek, unread, progress, open, onClick, onHold, onRelease }) => {
  const showPeek = peek !== null && !open;
  const PeekIcon = showPeek ? PEEK_ICONS[peek.kind] : IconCompass;
  const showCount = !showPeek && !open && unread > 0;
  return (
    <m.div layout transition={guideSpring} className="relative">
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
        className="surface-floating flex h-11 cursor-pointer select-none items-center overflow-hidden rounded-full border border-transparent p-1 text-[13px] transition-[scale] duration-150 ease-out active:scale-[0.96]"
      >
        <m.span layout="position" className="relative flex size-9 shrink-0 items-center justify-center">
          <ProgressRing progress={progress} />
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
              variants={guidePeekTextVariants}
              initial="hidden"
              animate="shown"
              exit="exit"
              aria-live="polite"
              className="flex items-center gap-2 whitespace-nowrap pr-3.5 pl-1.5"
            >
              <span className={cn("font-semibold", PEEK_TONES[peek.kind])}>{PEEK_LABELS[peek.kind]}</span>
              <span className="text-composer-text">{peek.gist}</span>
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
            className="pointer-events-none absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-composer-accent px-1 text-[11px] leading-none font-semibold text-composer-on-accent tabular-nums shadow-[0_0_0_2px_var(--color-composer-bg-dark)]"
          >
            {unread}
          </m.span>
        )}
      </AnimatePresence>
    </m.div>
  );
};

// -- Exports ------------------------------------------------------------------

export { GuideOrb };
