import { FileDropArea } from "@/audio/file-drop-area";
import { FileDropZone } from "@/audio/file-drop-zone";
import { YouTubeUrlInput } from "@/audio/youtube-url-input";
import { AUDIO_FORMATS_PROSE } from "@/domain/audio-file/supported-formats";
import { youtubeSourceTitle } from "@/domain/project/display-title";
import { useBridgeThumb } from "@/hooks/useBridgeThumb";
import { useLoadAudioFile } from "@/hooks/useLoadAudioFile";
import { PROJECT_FILE_EXTENSIONS_LABEL } from "@/lib/project-file-read";
import { importProjectFile } from "@/lib/project-import";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { fileExtensionLabel, fileNameWithoutExtension } from "@/utils/file-name";
import { formatFileSize } from "@/utils/format-file-size";
import { IMPORT_AREA, ImportZone, OrDivider, SourceCard } from "@/views/import/import-layout";
import { MissingAudioPanel } from "@/views/import/missing-audio-panel";
import {
  IconBrandYoutube,
  IconClock,
  IconFileMusic,
  IconFileUpload,
  IconLoader2,
  IconMusic,
} from "@tabler/icons-react";

// -- Constants ----------------------------------------------------------------

const LOAD_DROP_LABEL = "Drop to load audio or open a project";
const REPLACE_DROP_LABEL = "Drop to replace the audio or open a project";
const SUPPORTED_FILES_PROSE = `Supports ${AUDIO_FORMATS_PROSE}, or a project file (${PROJECT_FILE_EXTENSIONS_LABEL})`;

// -- Helpers ------------------------------------------------------------------

function openProjectFile(file: File): void {
  void importProjectFile(file);
}

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
    return (
      <img
        src={persistedThumb}
        alt=""
        className="size-full object-cover outline outline-1 -outline-offset-1 outline-white/10 rounded-[10px]"
      />
    );
  }
  if (loading || (bridgeEnabled && thumbQuery.isFetching)) {
    return <div className="size-full bg-(--layer-2) animate-pulse" />;
  }
  return <IconBrandYoutube size={24} />;
};

interface ReplaceControlsProps {
  onFileDrop: (file: File) => void;
}

const ReplaceControls: React.FC<ReplaceControlsProps> = ({ onFileDrop }) => (
  <>
    <FileDropZone
      accept="audio/*"
      onFileDrop={onFileDrop}
      onProjectFileDrop={openProjectFile}
      className="gap-1 px-0 py-2"
    >
      <IconFileUpload className="size-8 mb-2 text-composer-text-faint" stroke={1.5} />
      <p className="text-base font-medium text-(--label)">Drop another file to replace</p>
      <p className="text-[13px] text-(--muted)">
        or a project file to open it, or <span className="text-composer-accent-text">click to browse</span>
      </p>
    </FileDropZone>
    <OrDivider />
    <YouTubeUrlInput placeholder="Or load a different YouTube URL" />
  </>
);

interface SourceDurationProps {
  loading: boolean;
  duration: number;
}

// Shown in the imported-source row. While the source is loading (a YouTube
// download or an mp3 decode) it shows the spinner; once ready it shows the
// clock and resolved duration.
const SourceDuration: React.FC<SourceDurationProps> = ({ loading, duration }) => (
  <div className="flex items-center gap-[5px] shrink-0">
    {loading ? (
      <>
        <IconLoader2 size={14} className="animate-spin text-composer-accent-text" />
        <span className="text-[13px] font-mono font-medium text-(--muted) tabular-nums">--:--</span>
      </>
    ) : (
      <>
        <IconClock size={14} className="text-composer-text opacity-55" />
        <span className="text-[13px] font-mono font-medium text-composer-text tabular-nums select-text">
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
      <FileDropArea
        key="file"
        data-tour="import-dropzone"
        className={IMPORT_AREA}
        onFileDrop={handleFileDrop}
        onProjectFileDrop={openProjectFile}
        dropLabel={REPLACE_DROP_LABEL}
      >
        <ImportZone>
          <SourceCard
            art={<IconFileMusic size={24} />}
            title={fileName}
            subtitle={extension}
            trailing={
              <div className="flex flex-col items-end gap-[3px]">
                <SourceDuration loading={isLoading} duration={duration} />
                <div className="text-xs text-(--muted)">{formatFileSize(file.size)}</div>
              </div>
            }
          />
          <ReplaceControls onFileDrop={handleFileDrop} />
        </ImportZone>
      </FileDropArea>
    );
  }

  if (source && source.type === "youtube") {
    const videoId = source.videoId;
    const sourceTitle = youtubeSourceTitle(projectTitle, videoId);
    const downloading = isLoading && !source.file;
    const titleLoading = downloading && sourceTitle === videoId;

    return (
      <FileDropArea
        key="youtube"
        data-tour="import-dropzone"
        className={IMPORT_AREA}
        onFileDrop={handleFileDrop}
        onProjectFileDrop={openProjectFile}
        dropLabel={REPLACE_DROP_LABEL}
      >
        <ImportZone>
          <SourceCard
            art={<YouTubeSourceThumb videoId={videoId} loading={downloading} />}
            title={titleLoading ? <div className="h-4 w-40 rounded bg-(--layer-2) animate-pulse" /> : sourceTitle}
            subtitle={`${videoId} ・ ${downloading ? "Downloading from YouTube" : "from YouTube"}`}
            trailing={<SourceDuration loading={downloading} duration={duration} />}
          />
          <ReplaceControls onFileDrop={handleFileDrop} />
        </ImportZone>
      </FileDropArea>
    );
  }

  return (
    <FileDropArea
      key="empty"
      data-tour="import-dropzone"
      className={IMPORT_AREA}
      onFileDrop={handleFileDrop}
      onProjectFileDrop={openProjectFile}
      dropLabel={LOAD_DROP_LABEL}
    >
      <ImportZone>
        <FileDropZone
          accept="audio/*"
          onFileDrop={handleFileDrop}
          onProjectFileDrop={openProjectFile}
          className="gap-1 px-0 py-2"
        >
          <IconMusic className="size-11 mb-3 text-composer-text-faint" stroke={1.5} />
          <p className="text-base font-medium text-(--label)">Drop an audio or project file here</p>
          <p className="text-[13px] text-(--muted)">
            or <span className="text-composer-accent-text">click to browse</span>
          </p>
          <p className="mt-2.5 text-xs text-composer-text-muted">{SUPPORTED_FILES_PROSE}</p>
        </FileDropZone>

        <OrDivider />

        <YouTubeUrlInput />
      </ImportZone>
    </FileDropArea>
  );
};

// -- Exports ------------------------------------------------------------------

export { ImportPanel };
