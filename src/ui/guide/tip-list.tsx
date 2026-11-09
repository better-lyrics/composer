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
  waitsOn: (tip: GuideTip) => string | null;
  learned: readonly GuideTip[];
  onKnown: (tip: GuideTip) => void;
  onShow: (tip: GuideTip) => void;
}

// -- Constants ----------------------------------------------------------------

const VISIBLE_TIPS = 3;

// -- Components ---------------------------------------------------------------

const TipText: React.FC<{ tip: GuideTip; waitsOn: string | null }> = ({ tip, waitsOn }) => (
  <>
    <tip.icon
      className={cn("mt-0.5 size-4 shrink-0", waitsOn ? "text-(--muted)" : "text-composer-accent-text")}
      stroke={1.75}
    />
    <div className="min-w-0 flex-1">
      <div className={cn("text-[13px] font-medium", waitsOn && "text-(--label)")}>{tip.title}</div>
      <p className="mt-0.5 text-xs leading-[1.55] text-pretty text-(--label)">{tip.gist}</p>
      {waitsOn && <p className="mt-1 text-xs text-(--muted)">Comes after "{waitsOn}"</p>}
    </div>
  </>
);

const TipRow: React.FC<{ tip: GuideTip; waitsOn: string | null; onKnown: () => void; onShow: () => void }> = ({
  tip,
  waitsOn,
  onKnown,
  onShow,
}) => (
  <m.li
    layout="position"
    exit={guideRowExit}
    className="group flex gap-2.5 overflow-hidden rounded-[14px] py-2 pr-1.5 pl-2.5 transition-[background-color] duration-150 hover:bg-(--layer-1)"
  >
    {tip.spot ? (
      <button
        type="button"
        aria-label={`${tip.title}, show me where`}
        onClick={onShow}
        className="flex min-w-0 flex-1 cursor-pointer select-none gap-2.5 text-left"
      >
        <TipText tip={tip} waitsOn={waitsOn} />
      </button>
    ) : (
      <div className="flex min-w-0 flex-1 gap-2.5">
        <TipText tip={tip} waitsOn={waitsOn} />
      </div>
    )}
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
    <m.div layout="position" className="px-2.5">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((shown) => !shown)}
        className="flex h-8 cursor-pointer select-none items-center gap-2.5 text-xs text-(--muted) transition-[color] duration-150 hover:text-(--label)"
      >
        <IconCheck className="size-4 text-composer-positive" stroke={2} />
        <span className="flex items-center gap-1">
          {tips.length} learned
          <IconChevronDown className={cn("size-3.5 transition-[rotate] duration-150", expanded && "rotate-180")} />
        </span>
      </button>
      {expanded && (
        <ul className="space-y-1 pb-2 pl-6.5 text-xs text-(--muted)">
          {tips.map((tip) => (
            <li key={tip.id}>{tip.title}</li>
          ))}
        </ul>
      )}
    </m.div>
  );
};

const TipList: React.FC<TipListProps> = ({ open, waitsOn, learned, onKnown, onShow }) => {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? open : open.slice(0, VISIBLE_TIPS);
  const hiddenCount = open.length - shown.length;
  return (
    <m.div layout="position" className="pt-2.5 pb-0.5">
      <ul>
        <AnimatePresence initial={false}>
          {shown.map((tip) => (
            <TipRow
              key={tip.id}
              tip={tip}
              waitsOn={waitsOn(tip)}
              onKnown={() => onKnown(tip)}
              onShow={() => onShow(tip)}
            />
          ))}
        </AnimatePresence>
      </ul>
      <div className="flex items-center justify-between">
        <LearnedRow tips={learned} />
        {hiddenCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
            {hiddenCount} more
          </Button>
        )}
      </div>
    </m.div>
  );
};

// -- Exports ------------------------------------------------------------------

export { TipList };
