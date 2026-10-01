import { classifyPastedText } from "@/views/edit/smart-paste";
import { useImportContext } from "@/views/lyrics-import-modal/import-lyrics";
import { importLyricsText } from "@/views/lyrics-import-modal/import-lyrics-source";
import { useCallback } from "react";

// -- Types --------------------------------------------------------------------

interface SmartPasteOptions {
  typedPasteRef: React.RefObject<boolean>;
  onBeforeImport: () => void;
}

// -- Hook ---------------------------------------------------------------------

function useSmartPaste({ typedPasteRef, onBeforeImport }: SmartPasteOptions) {
  const pasteContext = useImportContext("Paste");

  return useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const text = event.clipboardData?.getData("text/plain") ?? "";
      if (classifyPastedText(text) === "typed-text") {
        typedPasteRef.current = true;
        return;
      }
      event.preventDefault();
      onBeforeImport();
      void importLyricsText(text, pasteContext);
    },
    [onBeforeImport, typedPasteRef, pasteContext],
  );
}

// -- Exports ------------------------------------------------------------------

export { useSmartPaste };
