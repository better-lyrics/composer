import { useExportTtml } from "@/hooks/use-export-ttml";
import { useIsActiveTab } from "@/hooks/use-is-active-tab";
import { useAudioStore } from "@/stores/audio";
import { EmptyState } from "@/ui/empty-state";
import { LyricsRenderer } from "@/views/preview/lyrics-renderer";
import { memo } from "react";

// -- Interfaces ---------------------------------------------------------------

interface PreviewContentProps {
  isVisible: boolean;
}

// -- Components ---------------------------------------------------------------

// Memoized on isVisible: editor re-renders skip the hidden tab, so it builds no TTML until shown.
const PreviewContent = memo<PreviewContentProps>(() => {
  const { content: ttmlString, duration, lineCount, syncedLineCount } = useExportTtml();
  const source = useAudioStore((s) => s.source);

  const hasSyncedContent = syncedLineCount > 0;

  if (!source) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState message="No audio loaded" hint="Import audio in the Import tab first" />
      </div>
    );
  }

  if (lineCount === 0) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState message="No lyrics to preview" hint="Add lyrics in the Edit tab first" />
      </div>
    );
  }

  if (!hasSyncedContent) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState message="No synced content" hint="Sync lyrics in the Sync tab first" />
      </div>
    );
  }

  return (
    <div data-tour="preview-panel" className="flex flex-col flex-1 overflow-hidden select-none">
      <h2 className="sr-only">Preview</h2>

      <LyricsRenderer ttmlString={ttmlString} durationSeconds={duration} />
    </div>
  );
});

const PreviewPanel: React.FC = () => {
  const isVisible = useIsActiveTab("preview");
  return <PreviewContent isVisible={isVisible} />;
};

// -- Exports ------------------------------------------------------------------

export { PreviewPanel };
