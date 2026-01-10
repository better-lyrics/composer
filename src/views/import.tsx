import { FileDropZone } from "@/audio/file-drop-zone";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { IconMusic, IconClock, IconFile } from "@tabler/icons-react";
import { useCallback } from "react";

// -- Helpers ------------------------------------------------------------------

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toUpperCase() || "AUDIO";
}

// -- Constants ----------------------------------------------------------------

const GUTTER_WIDTH = 56;
const ROW_HEIGHT = 56;

// -- Component ----------------------------------------------------------------

const ImportPanel: React.FC = () => {
  const source = useAudioStore((s) => s.source);
  const duration = useAudioStore((s) => s.duration);
  const setSource = useAudioStore((s) => s.setSource);
  const setMetadata = useProjectStore((s) => s.setMetadata);

  const handleFileDrop = useCallback(
    (file: File) => {
      setSource({ type: "file", file });
      setMetadata({ title: file.name.replace(/\.[^/.]+$/, "") });
    },
    [setSource, setMetadata],
  );

  if (source && source.type === "file") {
    const file = source.file;
    const extension = getFileExtension(file.name);
    const fileName = file.name.replace(/\.[^/.]+$/, "");

    return (
      <div className="flex flex-col-reverse flex-1 size-full">
        {/* Audio info row - matches LineRow design */}
        <div className="flex border-t border-composer-border">
          {/* Gutter */}
          <div
            className="shrink-0 flex items-center justify-center bg-composer-accent/10"
            style={{ width: GUTTER_WIDTH, height: ROW_HEIGHT }}
          >
            <IconFile size={16} className="text-composer-accent" />
          </div>

          {/* Content */}
          <div
            className="flex-1 flex items-center gap-6 px-4 border-l border-composer-accent/25"
            style={{ height: ROW_HEIGHT }}
          >
            {/* File name */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-composer-text">{fileName}</p>
              <p className="text-xs text-composer-text-muted">{extension}</p>
            </div>

            {/* Duration */}
            <div className="flex items-center gap-1.5">
              <IconClock size={14} className="text-composer-text-muted" />
              <span className="text-sm font-mono text-composer-text tabular-nums">{formatDuration(duration)}</span>
            </div>

            {/* File size */}
            <div className="text-sm text-composer-text-muted">{formatFileSize(file.size)}</div>
          </div>
        </div>

        {/* Replace drop zone */}
        <div className="flex-1 flex items-center justify-center">
          <FileDropZone accept="audio/*" onFileDrop={handleFileDrop}>
            <p className="text-sm text-composer-text-muted">Drop another file to replace</p>
          </FileDropZone>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 size-full">
      <FileDropZone accept="audio/*" onFileDrop={handleFileDrop}>
        <IconMusic className="w-12 h-12 mb-4 opacity-50 text-composer-text" stroke={1.5} />
        <p className="text-composer-text-secondary">Drop audio file here</p>
        <p className="mt-1 text-sm text-composer-text-muted">or click to browse</p>
        <p className="mt-4 text-xs text-composer-text-muted">Supports MP3, WAV, M4A, OGG, FLAC</p>
      </FileDropZone>
    </div>
  );
};

export { ImportPanel };
