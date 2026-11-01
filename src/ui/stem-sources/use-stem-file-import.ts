import type { StemSlot } from "@/domain/stems/stem-slot";
import { useSeparationStore } from "@/stores/separation";
import { isFileDrag } from "@/utils/file-drag";
import { useRef, useState } from "react";

// -- Types --------------------------------------------------------------------

type StemDropHandlers = Pick<React.DOMAttributes<HTMLElement>, "onDragOver" | "onDragLeave" | "onDrop">;

interface StemFileImport {
  fileInputProps: React.InputHTMLAttributes<HTMLInputElement> & { ref: React.Ref<HTMLInputElement> };
  openFilePicker: (slot: StemSlot) => void;
  dropSlot: StemSlot | null;
  dropHandlers: (slot: StemSlot) => StemDropHandlers;
}

// -- Hook ---------------------------------------------------------------------

function useStemFileImport(): StemFileImport {
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerSlotRef = useRef<StemSlot | null>(null);
  const [dropSlot, setDropSlot] = useState<StemSlot | null>(null);

  const importStem = (slot: StemSlot, file: File) => void useSeparationStore.getState().importStem(slot, file);

  const openFilePicker = (slot: StemSlot) => {
    pickerSlotRef.current = slot;
    inputRef.current?.click();
  };

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const slot = pickerSlotRef.current;
    event.target.value = "";
    if (file && slot) importStem(slot, file);
  };

  const dropHandlers = (slot: StemSlot): StemDropHandlers => ({
    onDragOver: (event) => {
      if (!isFileDrag(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      setDropSlot(slot);
    },
    onDragLeave: (event) => {
      if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
      setDropSlot(null);
    },
    onDrop: (event) => {
      if (!isFileDrag(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      setDropSlot(null);
      const file = event.dataTransfer.files[0];
      if (file) importStem(slot, file);
    },
  });

  return {
    fileInputProps: { ref: inputRef, type: "file", accept: "audio/*", hidden: true, tabIndex: -1, onChange },
    openFilePicker,
    dropSlot,
    dropHandlers,
  };
}

// -- Exports ------------------------------------------------------------------

export { useStemFileImport };
