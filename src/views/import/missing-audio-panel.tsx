import { FileDropZone } from "@/audio/file-drop-zone";
import { FileDropArea } from "@/audio/file-drop-area";
import { YouTubeUrlInput } from "@/audio/youtube-url-input";
import type { SavedAudioSource } from "@/domain/project/audio-source";
import { youtubeSourceTitle } from "@/domain/project/display-title";
import { relinkProjectAudioFile, relinkProjectVideo, retryProjectAudio } from "@/lib/relink-audio";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useUIStore } from "@/stores/ui";
import { Button } from "@/ui/button";
import { IMPORT_AREA, ImportZone, OrDivider, SourceCard } from "@/views/import/import-layout";
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
const RELINK_DROP_LABEL = "Drop to link the audio again";
const REPLACE_MISSING_DROP_LABEL = "Drop to use this audio instead";

const RELINK_DROP_STYLES = "gap-1 px-0 py-2 text-center rounded-xl";

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
  <SourceCard
    tone="warning"
    art={<IconAlertTriangle aria-hidden="true" className="size-6" />}
    title={name}
    subtitle={detail}
    trailing={children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
  />
);

const FileName: React.FC<{ name: string }> = ({ name }) => (
  <code className="px-1.5 py-px rounded-md bg-(--layer-2) font-mono text-[12.5px] font-medium text-composer-text break-all select-text">
    {name}
  </code>
);

// -- Component ----------------------------------------------------------------

const MissingAudioPanel: React.FC<MissingAudioPanelProps> = ({ expected }) => {
  const title = useProjectStore((state) => state.metadata.title);
  const failure = useAudioStore((state) => state.youtubeLoadFailure);
  const bridgeUnreachable = failure === "bridge-unreachable";

  return (
    <FileDropArea
      data-tour="import-dropzone"
      className={IMPORT_AREA}
      onFileDrop={relinkFile}
      dropLabel={expected.kind === "file" ? RELINK_DROP_LABEL : REPLACE_MISSING_DROP_LABEL}
    >
      <ImportZone tone="warning">
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
              <Button variant="ghost" size="sm" onClick={openBridgeSettings} className="px-3 text-[13px]">
                Bridge settings
              </Button>
            )}
            <Button variant="secondary" size="sm" hasIcon onClick={retryProjectAudio} className="pl-2.5 text-[13px]">
              <IconRefresh aria-hidden="true" className="size-4" />
              Try again
            </Button>
          </WarningSourceRow>
        )}

        <div className="w-full">
          <FileDropZone accept="audio/*" onFileDrop={relinkFile} className={RELINK_DROP_STYLES}>
            <IconFileAlert aria-hidden="true" className="size-11 mb-3 text-composer-warning" stroke={1.5} />
            {expected.kind === "file" ? (
              <>
                <p className="text-base font-medium text-(--label)">
                  Drop <FileName name={expected.name} /> to link it again
                </p>
                <p className="text-[13px] text-(--muted)">
                  If the file name is different, you confirm before it links.
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-medium text-(--label)">Drop an audio file to use instead</p>
                <p className="text-[13px] text-(--muted)">Your lyrics and timings stay as they are.</p>
              </>
            )}
          </FileDropZone>
        </div>
        <OrDivider />
        <YouTubeUrlInput
          placeholder={expected.kind === "file" ? "Or load it from YouTube" : "Or load a different YouTube URL"}
          onLoadVideo={relinkProjectVideo}
        />
      </ImportZone>
    </FileDropArea>
  );
};

// -- Exports ------------------------------------------------------------------

export { MissingAudioPanel };
