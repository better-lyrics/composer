import { FileDropZone } from "@/audio/file-drop-zone";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { IconCheck, IconMusic } from "@tabler/icons-react";
import { useCallback } from "react";

// -- Component ----------------------------------------------------------------

const ImportPanel: React.FC = () => {
  const source = useAudioStore((s) => s.source);
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
    return (
      <div className="flex flex-col items-center justify-center flex-1 size-full gap-4">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-composer-bg-elevated">
          <IconCheck className="w-5 h-5 text-green-500" />
          <span className="text-composer-text">{source.file.name}</span>
        </div>
        <FileDropZone accept="audio/*" onFileDrop={handleFileDrop}>
          <p className="text-sm text-composer-text-muted">Drop another file to replace</p>
        </FileDropZone>
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
