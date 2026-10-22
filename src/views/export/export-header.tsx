import type { TimingGranularity } from "@/domain/project/timing-granularity";
import { Button } from "@/ui/button";
import { SegmentedControl, type SegmentedOption } from "@/ui/segmented-control";
import { ProjectMenuButton } from "@/views/export/project-menu-button";
import { IconCheck, IconCopy, IconDownload, IconEdit, IconRefresh } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface ExportHeaderProps {
  syncedLineCount: number;
  lineCount: number;
  isEdited: boolean;
  isEditing: boolean;
  copied: boolean;
  exportTiming: TimingGranularity;
  lineTimingLocked: boolean;
  onExportTimingChange: (timing: TimingGranularity) => void;
  onRegenerate: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onDownload: () => void;
}

// -- Helpers ------------------------------------------------------------------

function exportTimingOptions(lineLocked: boolean): SegmentedOption<TimingGranularity>[] {
  return [
    { value: "word", label: "Word" },
    { value: "line", label: "Line", disabled: lineLocked },
  ];
}

// -- Components ---------------------------------------------------------------

const ExportHeader: React.FC<ExportHeaderProps> = ({
  syncedLineCount,
  lineCount,
  isEdited,
  isEditing,
  copied,
  exportTiming,
  lineTimingLocked,
  onExportTimingChange,
  onRegenerate,
  onEdit,
  onCopy,
  onDownload,
}) => (
  <div className="flex items-center justify-between gap-4 h-13 shrink-0 pl-5 pr-2 border-b border-(--divider)">
    <h2 className="sr-only">Export</h2>
    <div className="flex items-center gap-3">
      <span className="flex items-baseline gap-1.5 text-[13px] text-(--muted) tabular-nums select-none">
        <b className="font-mono text-[15px] font-bold text-composer-text">{syncedLineCount}</b> / {lineCount} lines
        synced{isEdited && " ・ edited"}
      </span>
      <ProjectMenuButton />
    </div>
    <div className="flex items-center gap-3">
      <SegmentedControl
        aria-label="Export timing"
        value={exportTiming}
        options={exportTimingOptions(lineTimingLocked)}
        onChange={onExportTimingChange}
      />
      {isEdited && (
        <Button hasIcon size="lg" onClick={onRegenerate}>
          <IconRefresh className="size-4" />
          Regenerate
        </Button>
      )}
      <Button
        hasIcon
        size="lg"
        variant={isEditing ? "primary" : "secondary"}
        disabled={exportTiming === "line"}
        onClick={onEdit}
      >
        <IconEdit className="size-4" />
        {isEditing ? "Done" : "Edit"}
      </Button>
      <Button hasIcon size="lg" onClick={onCopy}>
        {copied ? <IconCheck className="size-4" /> : <IconCopy className="size-4" />}
        {copied ? "Copied" : "Copy"}
      </Button>
      <Button hasIcon size="lg" variant="primary" onClick={onDownload}>
        <IconDownload className="size-4" />
        Download TTML
      </Button>
    </div>
  </div>
);

// -- Exports ------------------------------------------------------------------

export { ExportHeader };
