import { useDelayedBusy } from "@/hooks/use-delayed-busy";
import { useAlignmentStore } from "@/stores/alignment";
import { percent } from "@/utils/percent";
import { IconLoader2, IconWand } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface AutoAlignStatusProps {
  idleLabel?: string;
}

// -- Components ----------------------------------------------------------------

const AutoAlignStatus: React.FC<AutoAlignStatusProps> = ({ idleLabel }) => {
  const status = useAlignmentStore((s) => s.status);
  const progress = useAlignmentStore((s) => s.progress);
  const busy = status === "downloading" || status === "running";
  const showSpinner = useDelayedBusy(busy);
  if (!busy) {
    return (
      <>
        <IconWand aria-hidden="true" className="size-4" />
        {idleLabel}
      </>
    );
  }
  return (
    <>
      {showSpinner ? (
        <IconLoader2
          aria-hidden="true"
          className="size-4 text-composer-accent-text animate-spin motion-reduce:animate-none"
        />
      ) : (
        <IconWand aria-hidden="true" className="size-4" />
      )}
      {idleLabel}
      <span className="font-mono tabular-nums">
        {status === "downloading" ? `${percent(progress.done, progress.total)}%` : `${progress.done}/${progress.total}`}
      </span>
    </>
  );
};

// -- Exports -------------------------------------------------------------------

export { AutoAlignStatus };
