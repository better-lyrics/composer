import { openModalCount, useEscapeLayerStackStore } from "@/stores/escape-layer-stack";
import { Button } from "@/ui/button";
import { IconButton } from "@/ui/icon-button";
import { IconDownload, IconTrash, IconX } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface BulkBarProps {
  selectedCount: number;
  visibleCount: number;
  onSelectAll: () => void;
  onExport: () => void;
  onDelete: () => void;
  onClear: () => void;
}

// -- Constants ----------------------------------------------------------------

const BAR_STYLES =
  "flex items-center gap-1 p-1.5 rounded-[14px] bg-composer-bg-elevated pointer-events-auto select-none animate-[library-toast-in_200ms_var(--ease-emphasized)] shadow-pop";

// -- Sub-components -------------------------------------------------------------

const Divider: React.FC = () => <span aria-hidden="true" className="w-px h-5 mx-1 bg-composer-border" />;

// -- Component ----------------------------------------------------------------

const BulkBar: React.FC<BulkBarProps> = ({ selectedCount, visibleCount, onSelectAll, onExport, onDelete, onClear }) => {
  const modalOpen = useEscapeLayerStackStore((s) => openModalCount(s) > 0);
  if (selectedCount === 0 || modalOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-6 z-60 flex justify-center pointer-events-none">
      <div role="toolbar" aria-label="Selected projects" className={BAR_STYLES}>
        <span className="pl-2 pr-2.5 font-medium tabular-nums">{selectedCount} selected</span>
        {selectedCount < visibleCount && (
          <>
            <Button variant="quiet" size="sm" onClick={onSelectAll}>
              Select all {visibleCount}
            </Button>
            <Divider />
          </>
        )}
        <Button variant="quiet" size="sm" hasIcon onClick={onExport}>
          <IconDownload aria-hidden="true" className="size-3.5" />
          Export
        </Button>
        <Button variant="danger" size="sm" hasIcon onClick={onDelete}>
          <IconTrash aria-hidden="true" className="size-3.5" />
          Delete
        </Button>
        <Divider />
        <IconButton
          variant="quiet"
          label="Clear selection"
          icon={<IconX aria-hidden="true" className="size-4" />}
          onClick={onClear}
          className="size-7"
        />
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { BulkBar };
