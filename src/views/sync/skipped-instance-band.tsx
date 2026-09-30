import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { IconLink } from "@tabler/icons-react";

// -- Interfaces ---------------------------------------------------------------

interface SkippedInstanceBandProps {
  groupId: string;
  instanceIdx: number;
  firstLineIndex: number;
  skippedCount: number;
  color: string;
  onJumpToLine: (lineIndex: number) => void;
}

// -- Components ---------------------------------------------------------------

const SkippedInstanceBand: React.FC<SkippedInstanceBandProps> = ({
  groupId,
  instanceIdx,
  firstLineIndex,
  skippedCount,
  color,
  onJumpToLine,
}) => {
  const handleSyncAnyway = () => {
    useProjectStore.getState().setInstanceOwnTiming(groupId, instanceIdx, true);
    onJumpToLine(firstLineIndex);
  };

  return (
    <div
      className="flex items-center gap-1.5 h-7 pl-17 pr-2 text-[11px] text-composer-text-muted select-none"
      style={{ background: `color-mix(in srgb, ${color} 7%, transparent)` }}
    >
      <IconLink className="size-2.5" style={{ color }} />
      <span>{skippedCount} skipped</span>
      <span aria-hidden="true">·</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-1.5 text-[11px] font-normal text-composer-accent-text"
        onClick={handleSyncAnyway}
      >
        Sync anyway
      </Button>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { SkippedInstanceBand };
