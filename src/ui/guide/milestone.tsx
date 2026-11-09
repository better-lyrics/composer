import type { GuideTierId } from "@/domain/guide/model";
import { GUIDE_TIER_NAMES } from "@/guide/catalog/types";
import { Button } from "@/ui/button";
import { Medal } from "@/ui/guide/medal";
import { ProgressBar } from "@/ui/progress-bar";
import { guideMedalDropVariants, guideMedalPress, guideRevealVariants } from "@/utils/animationVariants";
import { m } from "motion/react";
import { useEffect, useState } from "react";

// -- Types --------------------------------------------------------------------

interface MilestoneProps {
  stageName: string;
  tier: GuideTierId;
  tipCount: number;
  next: { tier: GuideTierId; tipCount: number } | null;
  onContinue: () => void;
}

// -- Hooks --------------------------------------------------------------------

// The medal lands, presses like a key, and the meter fills behind it. Timers, not frames: three state flips.
function useMilestoneBeats() {
  const [pressed, setPressed] = useState(false);
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const timers = [
      window.setTimeout(() => setFilled(true), guideMedalPress.sweepStartMs),
      window.setTimeout(() => setPressed(true), guideMedalPress.downAtMs),
      window.setTimeout(() => setPressed(false), guideMedalPress.upAtMs),
    ];
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, []);
  return { pressed, filled };
}

// -- Component ----------------------------------------------------------------

const Milestone: React.FC<MilestoneProps> = ({ stageName, tier, tipCount, next, onContinue }) => {
  const { pressed, filled } = useMilestoneBeats();
  return (
    <m.div initial="hidden" animate="shown" className="flex flex-col items-center px-4 pt-5 pb-3 text-center">
      <m.div variants={guideMedalDropVariants}>
        <Medal tier={tier} state="earned" size="lg" pressed={pressed} />
      </m.div>
      <m.div custom={0} variants={guideRevealVariants} className="mt-4 text-base font-semibold text-balance">
        {stageName} {GUIDE_TIER_NAMES[tier].toLowerCase()}, done
      </m.div>
      <m.p
        custom={1}
        variants={guideRevealVariants}
        className="mt-1 max-w-[30ch] text-[13px] leading-relaxed text-pretty text-(--label)"
      >
        You've learned all {tipCount} tips in this tier.
      </m.p>
      <div className="mt-4 w-full max-w-[220px]">
        <ProgressBar
          percent={filled ? 100 : 0}
          segments={tipCount}
          complete
          sweepStepMs={guideMedalPress.sweepStepMs}
          label={`${GUIDE_TIER_NAMES[tier]} progress`}
          className="h-2"
        />
      </div>
      {next ? (
        <m.div
          custom={2}
          variants={guideRevealVariants}
          className="mt-5 flex w-full items-center gap-3 rounded-xl bg-(--layer-1) p-2.5 text-left shadow-[inset_0_0_0_1px_var(--layer-2)]"
        >
          <Medal tier={next.tier} state="open" size="md" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium">{GUIDE_TIER_NAMES[next.tier]} is open</div>
            <div className="text-xs text-(--muted)">{next.tipCount} new tips</div>
          </div>
          <Button variant="primary" size="sm" onClick={onContinue}>
            Show me
          </Button>
        </m.div>
      ) : (
        <m.div custom={2} variants={guideRevealVariants} className="mt-5">
          <Button variant="secondary" size="sm" onClick={onContinue}>
            Back to tips
          </Button>
        </m.div>
      )}
    </m.div>
  );
};

// -- Exports ------------------------------------------------------------------

export { Milestone };
