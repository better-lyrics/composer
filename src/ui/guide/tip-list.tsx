import type { GuideTip } from "@/guide/catalog/types";
import { Button } from "@/ui/button";
import { IconButton } from "@/ui/icon-button";
import { cn } from "@/utils/cn";
import { guideRowExit } from "@/utils/animationVariants";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { AnimatePresence, m } from "motion/react";
import { useState } from "react";

// -- Types --------------------------------------------------------------------

interface TipListProps {
  open: readonly GuideTip[];
  learned: readonly GuideTip[];
  onKnown: (tip: GuideTip) => void;
}

// -- Constants ----------------------------------------------------------------

const VISIBLE_TIPS = 3;

// -- Components ---------------------------------------------------------------

const TipRow: React.FC<{ tip: GuideTip; onKnown: () => void }> = ({ tip, onKnown }) => (
  <m.li
    layout="position"
    exit={guideRowExit}
    className="group flex gap-2.5 overflow-hidden rounded-[14px] px-2.5 py-2 transition-[background-color] duration-150 hover:bg-(--layer-1)"
  >
    <tip.icon className="mt-0.5 size-4 shrink-0 text-composer-accent-text" stroke={1.75} />
    <div className="min-w-0 flex-1">
      <div className="text-[13px] font-medium">{tip.title}</div>
      <p className="mt-0.5 text-xs leading-[1.55] text-pretty text-(--label)">{tip.gist}</p>
    </div>
    <IconButton
      variant="ghost"
      label={`I know "${tip.title}"`}
      icon={<IconCheck className="size-3.5" />}
      onClick={onKnown}
      className="size-6 shrink-0 rounded-md opacity-0 transition-[opacity,background-color,color] group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
    />
  </m.li>
);

const LearnedRow: React.FC<{ tips: readonly GuideTip[] }> = ({ tips }) => {
  const [expanded, setExpanded] = useState(false);
  if (tips.length === 0) return <span />;
  return (
    <div className="px-2.5">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((shown) => !shown)}
        className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-(--muted) transition-[color] duration-150 hover:text-(--label)"
      >
        <IconCheck className="size-3.5 text-composer-positive" stroke={2.25} />
        {tips.length} learned
        <IconChevronDown className={cn("size-3.5 transition-[rotate] duration-150", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <ul className="mt-1.5 space-y-1 pb-1 pl-5 text-xs text-(--muted)">
          {tips.map((tip) => (
            <li key={tip.id}>{tip.title}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

const TipList: React.FC<TipListProps> = ({ open, learned, onKnown }) => {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? open : open.slice(0, VISIBLE_TIPS);
  const hiddenCount = open.length - shown.length;
  return (
    <div className="pt-1.5 pb-1.5">
      <ul>
        <AnimatePresence initial={false}>
          {shown.map((tip) => (
            <TipRow key={tip.id} tip={tip} onKnown={() => onKnown(tip)} />
          ))}
        </AnimatePresence>
      </ul>
      <div className="flex items-center justify-between pr-1">
        <LearnedRow tips={learned} />
        {hiddenCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
            {hiddenCount} more
          </Button>
        )}
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { TipList };
