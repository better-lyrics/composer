import { UNSUPPORTED_AUDIO_FILE_MESSAGE, isSupportedAudioFile } from "@/domain/audio-file/supported-formats";
import { PROJECT_FILE_EXTENSIONS_LABEL, isProjectFileName } from "@/lib/project-file-read";
import { useCallback, useEffect, useRef, useState } from "react";
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

const UNSUPPORTED_AUDIO_OR_PROJECT_FILE_MESSAGE = `${UNSUPPORTED_AUDIO_FILE_MESSAGE} or a project file (${PROJECT_FILE_EXTENSIONS_LABEL})`;
const ONE_SONG_AT_A_TIME_MESSAGE = "Only one song loads at a time";

// -- Helpers ------------------------------------------------------------------

// Chrome adds the image file when a linked thumbnail is dragged, so a link that carries only images is a link drag.
function carriesFiles(e: React.DragEvent): boolean {
  const { types, items } = e.dataTransfer;
  if (!types.includes("Files")) return false;
  if (!types.includes("text/uri-list")) return true;
  return Array.from(items).some((item) => item.kind === "file" && !item.type.startsWith("image/"));
}

function isUsableFile(file: File, takesProjectFiles: boolean): boolean {
  return (takesProjectFiles && isProjectFileName(file.name)) || isSupportedAudioFile(file);
}

function forgetDetachedNodes(entered: Set<EventTarget>): void {
  for (const node of entered) if (node instanceof Node && !node.isConnected) entered.delete(node);
}

// -- Hook ---------------------------------------------------------------------

function useFileDrop({ onFileDrop, onProjectFileDrop, capture = false }: FileDropOptions): FileDrop {
  const [isDragging, setIsDragging] = useState(false);
  const enteredNodesRef = useRef(new Set<EventTarget>());

  const endDrag = useCallback(() => {
    enteredNodesRef.current.clear();
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener("drop", endDrag);
    window.addEventListener("dragend", endDrag);
    return () => {
      window.removeEventListener("drop", endDrag);
      window.removeEventListener("dragend", endDrag);
    };
  }, [isDragging, endDrag]);

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
      toast.error(onProjectFileDrop ? UNSUPPORTED_AUDIO_OR_PROJECT_FILE_MESSAGE : UNSUPPORTED_AUDIO_FILE_MESSAGE);
    },
    [onFileDrop, onProjectFileDrop],
  );

  const onDragEnter = useCallback((e: React.DragEvent) => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const entered = enteredNodesRef.current;
    forgetDetachedNodes(entered);
    entered.add(e.target);
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const entered = enteredNodesRef.current;
    entered.delete(e.target);
    forgetDetachedNodes(entered);
    if (entered.size === 0) setIsDragging(false);
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
      endDrag();
      const files = Array.from(e.dataTransfer.files);
      const usable = files.find((candidate) => isUsableFile(candidate, onProjectFileDrop !== undefined));
      const file = usable ?? files[0];
      if (!file) return;
      handleFile(file);
      if (usable && files.length > 1) toast(ONE_SONG_AT_A_TIME_MESSAGE);
    },
    [handleFile, endDrag, onProjectFileDrop],
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

export { UNSUPPORTED_AUDIO_OR_PROJECT_FILE_MESSAGE, useFileDrop };
