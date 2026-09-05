import { useExportTtml } from "@/hooks/use-export-ttml";
import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { AmLyricsRenderer } from "@/views/preview/am-lyrics-renderer";
import { BraccatoRenderer } from "@/views/preview/braccato-renderer";
import { IconPlayerPauseFilled, IconPlayerPlayFilled } from "@tabler/icons-react";

// -- Components ---------------------------------------------------------------

const PreviewPanel: React.FC = () => {
  const { content: ttmlString, duration, lineCount, syncedLineCount } = useExportTtml();
  const source = useAudioStore((s) => s.source);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const setIsPlaying = useAudioStore((s) => s.setIsPlaying);
  const renderer = useSettingsStore((s) => s.previewRenderer);

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
      <div className="flex items-center justify-between px-6 py-4 border-b border-composer-border">
        <h2 className="text-lg font-medium">Preview</h2>
        <Button variant="primary" hasIcon onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? <IconPlayerPauseFilled className="size-4" /> : <IconPlayerPlayFilled className="size-4" />}
          {isPlaying ? "Pause" : "Play"}
        </Button>
      </div>

      {renderer === "am-lyrics" ? (
        <AmLyricsRenderer ttmlString={ttmlString} durationSeconds={duration} />
      ) : (
        <BraccatoRenderer ttmlString={ttmlString} />
      )}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { PreviewPanel };
