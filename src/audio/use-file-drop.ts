import { UNSUPPORTED_AUDIO_FILE_MESSAGE, isSupportedAudioFile } from "@/domain/audio-file/supported-formats";
import { PROJECT_FILE_EXTENSIONS_LABEL, isProjectFileName } from "@/lib/project-file-read";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

// -- Types --------------------------------------------------------------------

interface FileDropOptions {
  onFileDrop: (file: File) => void;
  onProjectFileDrop?: (file: File) => void;
  capture?: boolean;
}

type FileDropHandlers = Pick<
  React.DOMAttributes<HTMLElement>,
  | "onDragEnter"
  | "onDragLeave"
  | "onDragOver"
  | "onDrop"
  | "onDragEnterCapture"
  | "onDragLeaveCapture"
  | "onDragOverCapture"
  | "onDropCapture"
>;

interface FileDrop {
  isDragging: boolean;
  handlers: FileDropHandlers;
  handleFile: (file: File) => void;
}

// -- Constants ----------------------------------------------------------------

const UNSUPPORTED_FILE_MESSAGE = `${UNSUPPORTED_AUDIO_FILE_MESSAGE} or a project file (${PROJECT_FILE_EXTENSIONS_LABEL})`;

// -- Helpers ------------------------------------------------------------------

function carriesFiles(e: React.DragEvent): boolean {
  return e.dataTransfer.types.includes("Files");
}

// -- Hook ---------------------------------------------------------------------

function useFileDrop({ onFileDrop, onProjectFileDrop, capture = false }: FileDropOptions): FileDrop {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);

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
    if (!carriesFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current++;
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = 0;
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handlers: FileDropHandlers = capture
    ? {
        onDragEnterCapture: onDragEnter,
        onDragLeaveCapture: onDragLeave,
        onDragOverCapture: onDragOver,
        onDropCapture: onDrop,
      }
    : { onDragEnter, onDragLeave, onDragOver, onDrop };
  return { isDragging, handlers, handleFile };
}

// -- Exports ------------------------------------------------------------------

export { useFileDrop };
