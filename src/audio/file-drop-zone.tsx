import { useFileDrop } from "@/audio/use-file-drop";
import { PROJECT_FILE_ACCEPT } from "@/lib/project-file-read";
import { cn } from "@/utils/cn";
import { useCallback, useId } from "react";

// -- Types --------------------------------------------------------------------

interface FileDropZoneProps {
  accept: string;
  onFileDrop: (file: File) => void;
  onProjectFileDrop?: (file: File) => void;
  children?: React.ReactNode;
  className?: string;
}

// -- Component ----------------------------------------------------------------

const FileDropZone: React.FC<FileDropZoneProps> = ({
  accept,
  onFileDrop,
  onProjectFileDrop,
  children,
  className,
}) => {
  const inputId = useId();
  const { isDragging, handlers, handleFile } = useFileDrop({ onFileDrop, onProjectFileDrop });

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
      {...handlers}
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
