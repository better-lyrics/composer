import { type PasteScope, classifyPastedText } from "@/views/edit/smart-paste";
import { useImportContext } from "@/views/lyrics-import-modal/import-lyrics";
import { importPastedLyrics, importProjectFileForLyrics } from "@/views/lyrics-import-modal/import-lyrics-source";
import { useCallback } from "react";

// -- Types --------------------------------------------------------------------

interface SmartPasteOptions {
  typedPasteRef: React.RefObject<boolean>;
  onBeforeImport: () => void;
}

// -- Helpers ------------------------------------------------------------------

function pasteScope(textarea: HTMLTextAreaElement): PasteScope {
  const { value, selectionStart, selectionEnd } = textarea;
  const coversAll = selectionStart === 0 && selectionEnd === value.length;
  return value.trim() === "" || coversAll ? "whole-text" : "insert";
}

// -- Hook ---------------------------------------------------------------------

function useSmartPaste({ typedPasteRef, onBeforeImport }: SmartPasteOptions) {
  const pasteContext = useImportContext("Paste");

  return useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const text = event.clipboardData?.getData("text/plain") ?? "";
      const duration = pasteContext.audioDuration > 0 ? pasteContext.audioDuration : undefined;
      const pasted = classifyPastedText(text, duration, pasteScope(event.currentTarget));
      if (pasted.kind === "typed-text") {
        typedPasteRef.current = true;
        return;
      }
      event.preventDefault();
      onBeforeImport();
      if (pasted.kind === "project-file") void importProjectFileForLyrics(pasted.contents, null, pasteContext);
      else void importPastedLyrics(text, pasted.parsed, pasteContext);
    },
    [onBeforeImport, typedPasteRef, pasteContext],
  );
}

// -- Exports ------------------------------------------------------------------

export { useSmartPaste };
