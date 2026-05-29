import { IconArrowLeft, IconClipboardText, IconMusic } from "@tabler/icons-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/utils/cn";

// -- Types --------------------------------------------------------------------

interface UploadSectionProps {
  onFile: (file: File) => void | Promise<void>;
  onSwitchToSearch: () => void;
  onSwitchToPaste: () => void;
}

// -- Constants ----------------------------------------------------------------

const ACCEPTED_EXTENSIONS = /\.(txt|lrc|srt|ttml|xml)$/i;
const ACCEPTED_FILE_INPUT = ".txt,.lrc,.srt,.ttml,.xml";

// -- Component ----------------------------------------------------------------

const UploadSection: React.FC<UploadSectionProps> = ({ onFile, onSwitchToSearch, onSwitchToPaste }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback(
    (file: File) => {
      if (!ACCEPTED_EXTENSIONS.test(file.name)) {
        toast.error("Unsupported file type. Use .txt .lrc .srt .ttml");
        return;
      }
      void onFile(file);
    },
    [onFile],
  );

  const handleClickToBrowse = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClickToBrowse();
      }
    },
    [handleClickToBrowse],
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) acceptFile(file);
    },
    [acceptFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) acceptFile(file);
      e.target.value = "";
    },
    [acceptFile],
  );

  return (
    <div className={cn("flex flex-col gap-2.5 p-3 rounded-lg", "bg-composer-input border border-composer-border")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-composer-text">Upload file</div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSwitchToSearch}
            className={cn(
              "inline-flex items-center gap-1 text-[11px] cursor-pointer bg-transparent border-none p-0",
              "text-composer-text-muted hover:text-composer-text-secondary",
            )}
          >
            <IconArrowLeft size={11} stroke={2} />
            Back to search
          </button>
          <button
            type="button"
            onClick={onSwitchToPaste}
            className={cn(
              "inline-flex items-center gap-1 text-[11px] cursor-pointer bg-transparent border-none p-0",
              "text-composer-text-muted hover:text-composer-text-secondary",
            )}
          >
            <IconClipboardText size={11} stroke={2} />
            Switch to paste
          </button>
        </div>
      </div>
      <div
        data-upload-dropzone
        role="button"
        tabIndex={0}
        aria-label="Drop a lyrics file here or click to browse"
        onClick={handleClickToBrowse}
        onKeyDown={handleKeyDown}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-lg text-center cursor-pointer",
          "bg-composer-bg-dark border border-dashed",
          "transition-colors",
          isDragOver ? "border-composer-accent" : "border-composer-border-strong hover:border-composer-border-strong",
        )}
      >
        <IconMusic size={32} stroke={1.5} className="text-composer-text-muted mb-0.5" />
        <div className="text-sm font-medium text-composer-text">Drop a lyrics file here</div>
        <div className="text-[11.5px] text-composer-text-muted">
          or <span className="text-composer-accent-text underline decoration-composer-accent/40">click to browse</span>
        </div>
        <div className="mt-1 font-mono text-[10.5px] tracking-tight text-composer-text-muted">.txt .lrc .srt .ttml</div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        aria-label="Import lyrics file"
        accept={ACCEPTED_FILE_INPUT}
        onChange={handleInputChange}
        className="sr-only"
      />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { UploadSection };
export type { UploadSectionProps };
