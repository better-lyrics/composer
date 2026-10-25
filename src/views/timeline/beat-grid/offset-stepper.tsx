import type { BeatGrid } from "@/domain/tempo/beat-grid";
import { withOffset } from "@/domain/tempo/grid-edits";
import { useProjectStore } from "@/stores/project";
import { IconButton } from "@/ui/icon-button";
import { IconMinus, IconPlus } from "@tabler/icons-react";

// -- Constants -----------------------------------------------------------------

const OFFSET_STEP_MS = 10;
const STEP_BUTTON_CLASS = "size-6 rounded-md hover:bg-(--layer-2) hover:text-composer-text";

// -- Helpers -------------------------------------------------------------------

function formatOffset(offsetMs: number): string {
  return `${offsetMs > 0 ? "+" : ""}${offsetMs} ms`;
}

// -- Components ----------------------------------------------------------------

const OffsetStepper: React.FC<{ grid: BeatGrid }> = ({ grid }) => {
  const earlier = withOffset(grid, grid.offsetMs - OFFSET_STEP_MS);
  const later = withOffset(grid, grid.offsetMs + OFFSET_STEP_MS);
  const apply = useProjectStore((s) => s.applyBeatGridWithHistory);

  return (
    <div className="tray tray-compact">
      <IconButton
        variant="ghost"
        label="Move grid earlier"
        icon={<IconMinus aria-hidden="true" className="size-3.5" />}
        disabled={earlier.offsetMs === grid.offsetMs}
        onClick={() => apply(earlier)}
        className={STEP_BUTTON_CLASS}
      />
      <span className="min-w-14 text-center font-mono text-xs leading-[1.3] font-medium tabular-nums text-composer-accent-text select-text cursor-text">
        {formatOffset(grid.offsetMs)}
      </span>
      <IconButton
        variant="ghost"
        label="Move grid later"
        icon={<IconPlus aria-hidden="true" className="size-3.5" />}
        disabled={later.offsetMs === grid.offsetMs}
        onClick={() => apply(later)}
        className={STEP_BUTTON_CLASS}
      />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { OffsetStepper };
