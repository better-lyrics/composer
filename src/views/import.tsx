import { FileDropZone } from "@/audio/file-drop-zone";
import { YouTubeUrlInput } from "@/audio/youtube-url-input";
import { AUDIO_FORMATS_PROSE } from "@/domain/audio-file/supported-formats";
import { youtubeSourceTitle } from "@/domain/project/display-title";
import { useBridgeThumb } from "@/hooks/useBridgeThumb";
import { useLoadAudioFile } from "@/hooks/useLoadAudioFile";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { fileExtensionLabel, fileNameWithoutExtension } from "@/utils/file-name";
import { formatFileSize } from "@/utils/format-file-size";
import { OrDivider, SOURCE_GUTTER_WIDTH, SOURCE_ROW_HEIGHT } from "@/views/import/import-layout";
import { MissingAudioPanel } from "@/views/import/missing-audio-panel";
import { IconBrandYoutube, IconClock, IconFile, IconLoader2, IconMusic } from "@tabler/icons-react";

// -- Helpers ------------------------------------------------------------------

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// -- Sub-components -----------------------------------------------------------

const YouTubeSourceThumb: React.FC<{ videoId: string; loading: boolean }> = ({ videoId, loading }) => {
  const bridgeEnabled = useSettingsStore((s) => s.experiments.youtubeBridge);
  const persistedThumb = useProjectStore((s) => s.metadata.thumbnailDataUrl);
  const persistedFor = useProjectStore((s) => s.metadata.thumbnailForVideoId);
  const hasMatchingPersistedThumb = Boolean(persistedThumb && persistedFor === videoId);
  const thumbQuery = useBridgeThumb();

  if (hasMatchingPersistedThumb) {
    return <img src={persistedThumb} alt="" className="size-full object-cover" />;
  }
  if (loading || (bridgeEnabled && thumbQuery.isFetching)) {
    return <div className="size-full bg-composer-bg-elevated animate-pulse" />;
  }
  return <IconBrandYoutube size={16} className="text-composer-accent" />;
};

interface ReplaceControlsProps {
  onFileDrop: (file: File) => void;
}

const ReplaceControls: React.FC<ReplaceControlsProps> = ({ onFileDrop }) => (
  <div className="flex flex-col items-center gap-4 flex-1 p-6 w-full">
    <div className="w-full max-w-md flex-1 min-h-32">
      <FileDropZone accept="audio/*" onFileDrop={onFileDrop}>
        <p className="text-sm text-composer-text-muted">Drop another file to replace</p>
      </FileDropZone>
    </div>
    <OrDivider />
    <YouTubeUrlInput placeholder="Or load a different YouTube URL" />
  </div>
);

interface SourceDurationProps {
  loading: boolean;
  duration: number;
}

// Shown in the imported-source row. While the source is loading (a YouTube
// download or an mp3 decode) it shows the spinner; once ready it shows the
// clock and resolved duration.
const SourceDuration: React.FC<SourceDurationProps> = ({ loading, duration }) => (
  <div className="flex items-center gap-1.5">
    {loading ? (
      <>
        <IconLoader2 size={14} className="animate-spin text-composer-accent" />
        <span className="text-sm font-mono text-composer-text-muted tabular-nums">--:--</span>
      </>
    ) : (
      <>
        <IconClock size={14} className="text-composer-text opacity-50" />
        <span className="text-sm font-mono text-composer-text tabular-nums select-text">
          {formatDuration(duration)}
        </span>
      </>
    )}
  </div>
);

// -- Component ----------------------------------------------------------------

const ImportPanel: React.FC = () => {
  const source = useAudioStore((s) => s.source);
  const duration = useAudioStore((s) => s.duration);
  const isLoading = useAudioStore((s) => s.isLoading);
  const projectTitle = useProjectStore((s) => s.metadata.title);
  const expectedAudio = useAudioStore((s) => s.expectedAudio);

  const handleFileDrop = useLoadAudioFile();

  if (!source && expectedAudio) return <MissingAudioPanel expected={expectedAudio} />;

  if (source && source.type === "file") {
    const file = source.file;
    const extension = fileExtensionLabel(file.name, "AUDIO");
    const fileName = fileNameWithoutExtension(file.name);

    return (
      <div data-tour="import-dropzone" className="flex flex-col-reverse flex-1 size-full">
        <div className="flex border-t border-composer-border">
          <div
            className="shrink-0 flex items-center justify-center bg-composer-accent/10"
            style={{ width: SOURCE_GUTTER_WIDTH, height: SOURCE_ROW_HEIGHT }}
          >
            <IconFile size={16} className="text-composer-accent" />
          </div>

          <div
            className="flex-1 flex items-center gap-6 px-4 border-l border-composer-accent/25"
            style={{ height: SOURCE_ROW_HEIGHT }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-composer-text select-text">{fileName}</p>
              <p className="text-xs text-composer-text-muted">{extension}</p>
            </div>

            <SourceDuration loading={isLoading} duration={duration} />

            <div className="text-sm text-composer-text-muted">{formatFileSize(file.size)}</div>
          </div>
        </div>

        <ReplaceControls onFileDrop={handleFileDrop} />
      </div>
    );
  }

  if (source && source.type === "youtube") {
    const videoId = source.videoId;
    const sourceTitle = youtubeSourceTitle(projectTitle, videoId);
    const downloading = isLoading && !source.file;
    const titleLoading = downloading && sourceTitle === videoId;

    return (
      <div data-tour="import-dropzone" className="flex flex-col-reverse flex-1 size-full">
        <div className="flex border-t border-composer-border">
          <div
            className="shrink-0 flex items-center justify-center bg-composer-accent/10 overflow-hidden"
            style={{ width: SOURCE_GUTTER_WIDTH, height: SOURCE_ROW_HEIGHT }}
          >
            <YouTubeSourceThumb videoId={videoId} loading={downloading} />
          </div>

          <div
            className="flex-1 flex items-center gap-6 px-4 border-l border-composer-accent/25"
            style={{ height: SOURCE_ROW_HEIGHT }}
          >
            <div className="flex-1 min-w-0">
              {titleLoading ? (
                <div className="h-4 w-40 rounded bg-composer-bg-elevated animate-pulse" />
              ) : (
                <p className="text-sm font-medium truncate text-composer-text select-text">{sourceTitle}</p>
              )}
              <p className="text-xs text-composer-text-muted select-text">
                {videoId} ・ {downloading ? "Downloading from YouTube" : "from YouTube"}
              </p>
            </div>

            <SourceDuration loading={downloading} duration={duration} />
          </div>
        </div>

        <ReplaceControls onFileDrop={handleFileDrop} />
      </div>
    );
  }

  return (
    <div data-tour="import-dropzone" className="flex flex-col items-center justify-center gap-6 flex-1 size-full p-6">
      <div className="w-full max-w-md flex-1 max-h-72 min-h-40">
        <FileDropZone accept="audio/*" onFileDrop={handleFileDrop}>
          <IconMusic className="size-12 mb-4 opacity-50 text-composer-text" stroke={1.5} />
          <p className="text-composer-text-secondary">Drop audio file here</p>
          <p className="mt-1 text-sm text-composer-text-muted">or click to browse</p>
          <p className="mt-4 text-xs text-composer-text-muted">Supports {AUDIO_FORMATS_PROSE}</p>
        </FileDropZone>
      </div>

      <OrDivider />

      <YouTubeUrlInput />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ImportPanel };
