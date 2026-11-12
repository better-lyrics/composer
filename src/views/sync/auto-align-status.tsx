import { useAlignmentStore } from "@/stores/alignment";
import { DelayedSpinner } from "@/ui/delayed-spinner";
import { percent } from "@/utils/percent";
import { IconWand } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface AutoAlignStatusProps {
  idleLabel?: string;
}

// -- Components ----------------------------------------------------------------

const AutoAlignStatus: React.FC<AutoAlignStatusProps> = ({ idleLabel }) => {
  const status = useAlignmentStore((s) => s.status);
  const progress = useAlignmentStore((s) => s.progress);
  const busy = status === "downloading" || status === "running";
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
      <DelayedSpinner
        busy={busy}
        className="size-4 text-composer-accent-text"
        idle={<IconWand aria-hidden="true" className="size-4" />}
      />
      {idleLabel}
      <span className="font-mono tabular-nums">
        {status === "downloading" ? `${percent(progress.done, progress.total)}%` : `${progress.done}/${progress.total}`}
      </span>
    </>
  );
};

// -- Exports -------------------------------------------------------------------

export { AutoAlignStatus };
