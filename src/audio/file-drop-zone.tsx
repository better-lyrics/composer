import { UNSUPPORTED_AUDIO_FILE_MESSAGE, isSupportedAudioFile } from "@/domain/audio-file/supported-formats";
import { PROJECT_FILE_ACCEPT, PROJECT_FILE_EXTENSIONS_LABEL, isProjectFileName } from "@/lib/project-file-read";
import { cn } from "@/utils/cn";
import { useCallback, useId, useRef, useState } from "react";
import { toast } from "sonner";

// -- Types --------------------------------------------------------------------

interface FileDropZoneProps {
  accept: string;
  onFileDrop: (file: File) => void;
  onProjectFileDrop?: (file: File) => void;
  children?: React.ReactNode;
  className?: string;
}

// -- Constants ----------------------------------------------------------------

const UNSUPPORTED_FILE_MESSAGE = `${UNSUPPORTED_AUDIO_FILE_MESSAGE} or a project file (${PROJECT_FILE_EXTENSIONS_LABEL})`;

// -- Component ----------------------------------------------------------------

const FileDropZone: React.FC<FileDropZoneProps> = ({ accept, onFileDrop, onProjectFileDrop, children, className }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputId = useId();
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

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current++;
    if (dragCountRef.current === 1) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current--;
    if (dragCountRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCountRef.current = 0;
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) {
        handleFile(file);
      }
    },
    [handleFile],
  );

  return (
    <label
      htmlFor={inputId}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        "size-full flex cursor-pointer flex-col items-center justify-center p-8 transition-colors",
        "border-composer-border hover:border-composer-border-hover",
        className,
        isDragging && "border-composer-accent bg-composer-accent/10",
      )}
    >
      <input
        id={inputId}
        type="file"
        aria-label={onProjectFileDrop ? "Upload audio or project file" : "Upload audio file"}
        accept={onProjectFileDrop ? `${accept},${PROJECT_FILE_ACCEPT}` : accept}
        onChange={handleInputChange}
        className="sr-only"
      />
      {children}
    </label>
  );
};

export { FileDropZone };
