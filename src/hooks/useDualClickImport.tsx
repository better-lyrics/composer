import { useCallback, useRef } from "react";
import { LYRICS_FILE_ACCEPT_ATTRIBUTE } from "@/domain/lyrics-file/supported-formats";
import { importLyricsFile, useImportContext } from "@/views/lyrics-import-modal/import-lyrics";

// -- Constants ----------------------------------------------------------------

const SINGLE_CLICK_DELAY_MS = 220;

// -- Hook ---------------------------------------------------------------------

interface DualClickImportHandlers {
  onClick: () => void;
  onDoubleClick: () => void;
  fileInput: React.ReactElement;
}

function useDualClickImport(openModal: () => void): DualClickImportHandlers {
  const importContext = useImportContext("File");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const clickTimerRef = useRef<number | null>(null);

  const triggerDirectUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onClick = useCallback(() => {
    if (clickTimerRef.current !== null) return;
    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null;
      openModal();
    }, SINGLE_CLICK_DELAY_MS);
  }, [openModal]);

  const onDoubleClick = useCallback(() => {
    if (clickTimerRef.current !== null) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    triggerDirectUpload();
  }, [triggerDirectUpload]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) await importLyricsFile(file, importContext);
    },
    [importContext],
  );

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      aria-label="Direct lyrics upload picker"
      accept={LYRICS_FILE_ACCEPT_ATTRIBUTE}
      onChange={handleFileChange}
      className="sr-only"
      tabIndex={-1}
    />
  );

  return { onClick, onDoubleClick, fileInput };
}

// -- Exports ------------------------------------------------------------------

export { useDualClickImport };
