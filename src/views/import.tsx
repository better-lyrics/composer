import { FileDropZone } from "@/audio/file-drop-zone";
import { Waveform } from "@/audio/waveform";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { IconMusic } from "@tabler/icons-react";
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

  if (source) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <Waveform />
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
