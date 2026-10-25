import { Button } from "@/ui/button";
import { slideUpVariants, springSnappy } from "@/utils/animationVariants";
import { IconCheck } from "@tabler/icons-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";

// -- Types --------------------------------------------------------------------

interface GuideCardState {
  task: string;
  stepLabel: string;
  stepIndex: number;
  isComplete: boolean;
}

interface GuideCardProps {
  state: GuideCardState | null;
  onSkip: () => void;
}

// -- Component ----------------------------------------------------------------

const GuideCard: React.FC<GuideCardProps> = ({ state, onSkip }) => {
  const reducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {state && (
        <m.div
          variants={slideUpVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={reducedMotion ? { duration: 0 } : springSnappy}
          className="fixed bottom-6 right-6 z-10001 w-72 rounded-[14px] surface-floating p-4 select-none"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-composer-text">
                {state.isComplete ? (
                  <span className="flex items-center gap-1.5">
                    <IconCheck className="size-4 text-composer-positive" />
                    Done!
                  </span>
                ) : (
                  state.task
                )}
              </p>
              <p className="mt-1 text-xs tabular-nums text-(--muted)">{state.stepLabel}</p>
            </div>
            {!state.isComplete && (
              <Button size="sm" variant="ghost" onClick={onSkip}>
                Skip
              </Button>
            )}
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
};

// -- Exports ------------------------------------------------------------------

export { GuideCard };
export type { GuideCardState };
