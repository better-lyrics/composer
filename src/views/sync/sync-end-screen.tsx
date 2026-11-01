import { shimmerTransition, shimmerVariants } from "@/utils/animationVariants";
import { readToken } from "@/utils/theme/read-token";
import { m } from "motion/react";

// -- Interfaces ---------------------------------------------------------------

interface SyncEndScreenProps {
  syncComplete: boolean;
}

// -- Components ---------------------------------------------------------------

const SyncCompleteMessage: React.FC = () => {
  const shimmerBase = readToken("accent-text");
  const shimmerHighlight = readToken("text");
  const completeGradient = `linear-gradient(45deg, ${shimmerBase} 0%, ${shimmerBase} 40%, ${shimmerHighlight} 50%, ${shimmerBase} 60%, ${shimmerBase} 100%)`;
  return (
    <div className="text-center">
      {/* react-doctor-disable-next-line react-doctor/no-gradient-text */}
      <m.div
        className="mb-2 text-2xl font-medium"
        variants={shimmerVariants}
        initial="initial"
        animate="animate"
        transition={shimmerTransition}
        style={{
          background: completeGradient,
          backgroundSize: "200% 100%",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          color: "transparent",
        }}
      >
        Sync complete!
      </m.div>
      <div className="text-composer-text-muted">Proceed to Preview to review your work</div>
    </div>
  );
};

const SyncEndScreen: React.FC<SyncEndScreenProps> = ({ syncComplete }) => (
  <div className="flex flex-col items-center justify-center flex-1 px-12 py-12">
    {syncComplete ? (
      <SyncCompleteMessage />
    ) : (
      <div className="text-center">
        <div className="mb-2 text-2xl font-medium text-composer-text">End of lyrics</div>
        <div className="text-composer-text-muted">Some lines still need timing. Pause to pick one.</div>
      </div>
    )}
  </div>
);

// -- Exports ------------------------------------------------------------------

export { SyncEndScreen };
