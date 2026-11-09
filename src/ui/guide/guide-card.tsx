import { GuideOptionsMenu } from "@/ui/guide/guide-options-menu";
import { IconButton } from "@/ui/icon-button";
import { ProgressBar } from "@/ui/progress-bar";
import { guideCardVariants, guideChunkVariants } from "@/utils/animationVariants";
import { IconArrowLeft, IconAward } from "@tabler/icons-react";
import { m } from "motion/react";

// -- Types --------------------------------------------------------------------

interface GuideCardProps {
  stepTitle: string;
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
    className="surface-floating w-[420px] max-w-[calc(100vw-2rem)] origin-bottom-right rounded-[20px] border border-transparent p-1.5"
  >
    <m.div variants={guideChunkVariants} className="flex items-center gap-2 py-1 pr-1 pl-2.5">
      <span className="truncate text-[13px] font-semibold">{stepTitle}</span>
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
    <m.div variants={guideChunkVariants} className="px-2.5 pt-1 pb-2">
      <ProgressBar
        percent={(doneCount / stepTotal) * 100}
        segments={stepTotal}
        complete={doneCount === stepTotal}
        label="Project progress"
        className="h-1"
      />
    </m.div>
    <m.div variants={guideChunkVariants}>{children}</m.div>
  </m.section>
);

// -- Exports ------------------------------------------------------------------

export { GuideCard };
