import { UNSUPPORTED_AUDIO_FILE_MESSAGE, isSupportedAudioFile } from "@/domain/audio-file/supported-formats";
import { PROJECT_FILE_EXTENSIONS_LABEL, isProjectFileName } from "@/lib/project-file-read";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

// -- Types --------------------------------------------------------------------

interface FileDropOptions {
  onFileDrop: (file: File) => void;
  onProjectFileDrop?: (file: File) => void;
}

interface FileDropHandlers {
  onDragEnter: React.DragEventHandler;
  onDragLeave: React.DragEventHandler;
  onDragOver: React.DragEventHandler;
  onDrop: React.DragEventHandler;
}

interface FileDrop {
  isDragging: boolean;
  handlers: FileDropHandlers;
  handleFile: (file: File) => void;
}

// -- Constants ----------------------------------------------------------------

const UNSUPPORTED_FILE_MESSAGE = `${UNSUPPORTED_AUDIO_FILE_MESSAGE} or a project file (${PROJECT_FILE_EXTENSIONS_LABEL})`;

// -- Hook ---------------------------------------------------------------------

function useFileDrop({ onFileDrop, onProjectFileDrop }: FileDropOptions): FileDrop {
  const [isDragging, setIsDragging] = useState(false);
  const dragCountRef = useRef(0);

  const handleFile = useCallback(
    (file: File) => {
      if (onProjectFileDrop && isProjectFileName(file.name)) {
        onProjectFileDrop(file);
        return;
      }
      if (isSupportedAudioFile(file)) {
        onFileDrop(file);
        return;
      }
      toast.error(onProjectFileDrop ? UNSUPPORTED_FILE_MESSAGE : UNSUPPORTED_AUDIO_FILE_MESSAGE);
    },
    [onFileDrop, onProjectFileDrop],
  );

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current++;
    if (dragCountRef.current === 1) setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current = Math.max(0, dragCountRef.current - 1);
    if (dragCountRef.current === 0) setIsDragging(false);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCountRef.current = 0;
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return { isDragging, handlers: { onDragEnter, onDragLeave, onDragOver, onDrop }, handleFile };
}

// -- Exports ------------------------------------------------------------------

export { useFileDrop };
export type { FileDrop, FileDropHandlers };
