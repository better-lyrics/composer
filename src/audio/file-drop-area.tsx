import { FileDropOverlay } from "@/audio/file-drop-overlay";
import { useFileDrop } from "@/audio/use-file-drop";
import { cn } from "@/utils/cn";

// -- Types --------------------------------------------------------------------

interface FileDropAreaProps extends Omit<React.ComponentProps<"div">, "onDrop"> {
  onFileDrop: (file: File) => void;
  dropLabel: string;
}

// -- Component ----------------------------------------------------------------

const FileDropArea: React.FC<FileDropAreaProps> = ({ onFileDrop, dropLabel, className, children, ...divProps }) => {
  const { isDragging, handlers } = useFileDrop({ onFileDrop, capture: true });
  return (
    <div {...divProps} className={cn("relative", className)} {...handlers}>
      {children}
      <FileDropOverlay visible={isDragging} label={dropLabel} />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { FileDropArea };
