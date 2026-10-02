import { FileDropZone } from "@/audio/file-drop-zone";
import { YouTubeUrlInput } from "@/audio/youtube-url-input";
import type { SavedAudioSource } from "@/domain/project/audio-source";
import { youtubeSourceTitle } from "@/domain/project/display-title";
import { relinkProjectAudioFile, relinkProjectVideo, retryProjectAudio } from "@/lib/relink-audio";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useUIStore } from "@/stores/ui";
import { Button } from "@/ui/button";
import { OrDivider, SOURCE_GUTTER_WIDTH, SOURCE_ROW_HEIGHT } from "@/views/import/import-layout";
import { IconAlertTriangle, IconFileAlert, IconRefresh } from "@tabler/icons-react";
import { toast } from "sonner";

// -- Types --------------------------------------------------------------------

interface MissingAudioPanelProps {
  expected: SavedAudioSource;
}

interface WarningSourceRowProps {
  name: string;
  detail: string;
  children?: React.ReactNode;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[MissingAudio]";
const RELINK_DROP_STYLES =
  "gap-1.5 p-6 text-center rounded-xl border-2 border-dashed border-composer-warning/40 hover:border-composer-warning/60 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-composer-accent";

// -- Actions ------------------------------------------------------------------

function relinkFile(file: File): void {
  relinkProjectAudioFile(file).catch((error: unknown) => {
    console.error(LOG_PREFIX, "could not link the file", error);
    toast.error("Couldn't link that file");
  });
}

function openBridgeSettings(): void {
  useUIStore.getState().openSettings({ target: { setting: "youtubeBridge" } });
}

// -- Sub-components -----------------------------------------------------------

const WarningSourceRow: React.FC<WarningSourceRowProps> = ({ name, detail, children }) => (
  <div className="flex border-t border-composer-border">
    <div
      className="shrink-0 flex items-center justify-center bg-composer-warning/12 text-composer-warning"
      style={{ width: SOURCE_GUTTER_WIDTH, height: SOURCE_ROW_HEIGHT }}
    >
      <IconAlertTriangle aria-hidden="true" className="size-4" />
    </div>
    <div
      className="flex-1 min-w-0 flex items-center gap-3 px-4 border-l border-composer-warning/30"
      style={{ height: SOURCE_ROW_HEIGHT }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-composer-text select-text">{name}</p>
        <p className="text-xs text-composer-warning select-text">{detail}</p>
      </div>
      {children}
    </div>
  </div>
);

const FileName: React.FC<{ name: string }> = ({ name }) => (
  <code className="px-1.5 py-px rounded bg-composer-button font-mono text-[12.5px] font-medium text-composer-text select-text">
    {name}
  </code>
);

// -- Component ----------------------------------------------------------------

const MissingAudioPanel: React.FC<MissingAudioPanelProps> = ({ expected }) => {
  const title = useProjectStore((state) => state.metadata.title);
  const failure = useAudioStore((state) => state.youtubeLoadFailure);
  const bridgeUnreachable = failure === "bridge-unreachable";

  return (
    <div data-tour="import-dropzone" className="flex flex-col-reverse flex-1 size-full">
      {expected.kind === "file" ? (
        <WarningSourceRow name={expected.name} detail="Not on this device. Your lyrics and timings are safe." />
      ) : (
        <WarningSourceRow
          name={youtubeSourceTitle(title, expected.videoId)}
          detail={
            bridgeUnreachable ? "Start Composer Bridge, then try again." : "Couldn't load the audio from YouTube."
          }
        >
          {bridgeUnreachable && (
            <Button variant="ghost" size="sm" onClick={openBridgeSettings}>
              Bridge settings
            </Button>
          )}
          <Button variant="secondary" size="sm" hasIcon onClick={retryProjectAudio}>
            <IconRefresh aria-hidden="true" className="size-3.5" />
            Try again
          </Button>
        </WarningSourceRow>
      )}

      <div className="flex flex-col items-center gap-4 flex-1 p-6 w-full">
        <div className="w-full max-w-md flex-1 min-h-32 max-h-72">
          <FileDropZone accept="audio/*" onFileDrop={relinkFile} className={RELINK_DROP_STYLES}>
            <IconFileAlert aria-hidden="true" className="size-7 mb-1.5 text-composer-warning" stroke={1.5} />
            {expected.kind === "file" ? (
              <>
                <p className="text-sm font-medium text-composer-text-secondary">
                  Drop <FileName name={expected.name} /> to link it again
                </p>
                <p className="text-xs text-composer-text-muted">
                  If the file name is different, you confirm before it links.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-composer-text-secondary">Drop an audio file to use instead</p>
                <p className="text-xs text-composer-text-muted">Your lyrics and timings stay as they are.</p>
              </>
            )}
          </FileDropZone>
        </div>
        <OrDivider />
        <YouTubeUrlInput
          placeholder={expected.kind === "file" ? "Or load it from YouTube" : "Or load a different YouTube URL"}
          onLoadVideo={relinkProjectVideo}
        />
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { MissingAudioPanel };
