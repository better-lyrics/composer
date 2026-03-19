import { Button } from "@/ui/button";
import { slideUpVariants, springSnappy } from "@/utils/animationVariants";
import { IconCheck } from "@tabler/icons-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

// -- Types --------------------------------------------------------------------

interface GuideCardState {
  task: string;
  stepLabel: string;
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
        <motion.div
          variants={slideUpVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={reducedMotion ? { duration: 0 } : springSnappy}
          className="fixed bottom-6 right-6 z-10001 w-72 rounded-r-xl border border-composer-border border-l-2 border-l-composer-accent/75 bg-composer-bg-dark p-4 pl-5 shadow-2xl select-none"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-composer-text">
                {state.isComplete ? (
                  <span className="flex items-center gap-1.5">
                    <IconCheck className="w-4 h-4 text-green-400" />
                    Done!
                  </span>
                ) : (
                  state.task
                )}
              </p>
              <p className="mt-1 text-xs text-composer-text-muted">{state.stepLabel}</p>
            </div>
            {!state.isComplete && (
              <Button size="sm" variant="ghost" onClick={onSkip}>
                Skip
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// -- Exports ------------------------------------------------------------------

export { GuideCard };
export type { GuideCardState };
