import { GuideOptionsMenu } from "@/ui/guide/guide-options-menu";
import { IconButton } from "@/ui/icon-button";
import { ProgressBar } from "@/ui/progress-bar";
import { Scroll } from "@/ui/scroll";
import { guideCardVariants, guideChunkVariants } from "@/utils/animationVariants";
import { IconArrowLeft, IconAward, IconChevronRight } from "@tabler/icons-react";
import { m } from "motion/react";

// -- Types --------------------------------------------------------------------

interface GuideCardProps {
  stepTitle: string;
  goToStep?: { stageName: string; onGo: () => void };
  stepNumber: number | null;
  doneCount: number;
  stepTotal: number;
  showingRecord: boolean;
  showAll: boolean;
  onToggleRecord: () => void;
  onToggleShowAll: () => void;
  onOpenHelp: () => void;
  onStartOver: () => void;
  onHide: () => void;
  children: React.ReactNode;
}

// -- Component ----------------------------------------------------------------

const GuideCard: React.FC<GuideCardProps> = ({
  stepTitle,
  goToStep,
  stepNumber,
  doneCount,
  stepTotal,
  showingRecord,
  onToggleRecord,
  children,
  ...options
}) => (
  <m.section
    aria-label="Guide"
    variants={guideCardVariants}
    initial="hidden"
    animate="shown"
    exit="exit"
    className="surface-floating flex max-h-[calc(100dvh-16rem)] w-[420px] max-w-[calc(100vw-2rem)] origin-bottom-right flex-col overflow-hidden rounded-[20px] border border-transparent p-1.5"
  >
    <m.div variants={guideChunkVariants} className="flex items-center gap-2 py-1 pr-1 pl-2.5">
      {goToStep ? (
        <button
          type="button"
          aria-label={`${stepTitle}, go to ${goToStep.stageName}`}
          onClick={goToStep.onGo}
          className="group/step flex min-w-0 cursor-pointer select-none items-center gap-0.5 text-[13px] font-semibold"
        >
          <span className="truncate">{stepTitle}</span>
          <IconChevronRight className="size-3.5 shrink-0 text-(--muted) transition-[color,translate] duration-150 group-hover/step:translate-x-0.5 group-hover/step:text-composer-text" />
        </button>
      ) : (
        <span className="truncate text-[13px] font-semibold">{stepTitle}</span>
      )}
      <span className="shrink-0 text-xs text-(--muted) tabular-nums">
        {stepNumber === null ? `All ${stepTotal} steps done` : `Step ${stepNumber} of ${stepTotal}`}
      </span>
      <span className="ml-auto flex shrink-0 items-center">
        <IconButton
          variant="ghost"
          label={showingRecord ? "Back to tips" : "Your record"}
          icon={showingRecord ? <IconArrowLeft className="size-4" /> : <IconAward className="size-4" />}
          onClick={onToggleRecord}
          className="size-7 rounded-lg"
        />
        <GuideOptionsMenu {...options} />
      </span>
    </m.div>
    <m.div variants={guideChunkVariants} className="px-2.5 pt-0.5 pb-4">
      <ProgressBar
        percent={(doneCount / stepTotal) * 100}
        segments={stepTotal}
        complete={doneCount === stepTotal}
        label="Project progress"
        className="h-1"
      />
    </m.div>
    <m.div variants={guideChunkVariants} className="flex min-h-0 flex-col">
      <Scroll className="-mx-1.5 -mb-1.5 min-h-0 px-1.5 pb-1.5">{children}</Scroll>
    </m.div>
  </m.section>
);

// -- Exports ------------------------------------------------------------------

export { GuideCard };
