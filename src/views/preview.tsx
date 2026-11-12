import { useExportTtml } from "@/hooks/use-export-ttml";
import { useAudioStore } from "@/stores/audio";
import { EmptyState } from "@/ui/empty-state";
import { GoToTabButton } from "@/ui/go-to-tab-button";
import { LyricsRenderer } from "@/views/preview/lyrics-renderer";

// -- Components ---------------------------------------------------------------

const PreviewPanel: React.FC = () => {
  const { content: ttmlString, duration, lineCount, syncedLineCount } = useExportTtml();
  const source = useAudioStore((s) => s.source);

  const hasSyncedContent = syncedLineCount > 0;

  if (!source) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState
          message="No audio loaded"
          hint="Preview plays your lyrics against the song."
          action={<GoToTabButton tab="import">Import audio</GoToTabButton>}
        />
      </div>
    );
  }

  if (lineCount === 0) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState
          message="No lyrics to preview"
          hint="Preview shows your lyrics as they will look."
          action={<GoToTabButton tab="edit">Add lyrics</GoToTabButton>}
        />
      </div>
    );
  }

  if (!hasSyncedContent) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState
          message="No synced content"
          hint="Lyrics need timing before they can play in step."
          action={<GoToTabButton tab="sync">Sync lyrics</GoToTabButton>}
        />
      </div>
    );
  }

  return (
    <div data-tour="preview-panel" className="flex flex-col flex-1 overflow-hidden select-none">
      <h2 className="sr-only">Preview</h2>

      <LyricsRenderer ttmlString={ttmlString} durationSeconds={duration} />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { PreviewPanel };
