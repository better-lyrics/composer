import { IconFileImport } from "@tabler/icons-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAudioStore } from "@/stores/audio";
import { useConfirm } from "@/stores/confirm-store";
import { type ImportModalSection, useImportModalState, useImportModalStore } from "@/stores/import-modal-store";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { Button } from "@/ui/button";
import { Modal } from "@/ui/modal";
import type { LyricLine } from "@/domain/line/model";
import type { LyricsSearchResult } from "@/domain/lyrics-search/result";
import { parseLyricsFile } from "@/utils/lyrics-parsers";
import type { ParseResult } from "@/utils/lyrics-parsers/shared";
import { textToLyricLines } from "@/utils/lyrics-text";
import { PasteSection } from "@/views/lyrics-import-modal/paste-section";
import { SearchSection } from "@/views/lyrics-import-modal/search-section";
import { UploadSection } from "@/views/lyrics-import-modal/upload-section";
import {
  importParsedLyrics,
  type ImportParsedLyricsContext,
  type ImportSourceInfo,
} from "@/views/lyrics-import-modal/use-import-modal-actions";

// -- Helpers ------------------------------------------------------------------

function wrapTextAsParseResult(lines: LyricLine[]): ParseResult {
  return { lines, metadata: {}, hasTimingData: false };
}

function syntheticFilenameForResult(result: LyricsSearchResult): string {
  const ext = result.payload.kind === "lrc" ? "lrc" : "ttml";
  return `${result.source}-${result.id}.${ext}`;
}

async function payloadToContent(result: LyricsSearchResult, signal: AbortSignal): Promise<string | null> {
  if (result.payload.kind === "ttml") return result.payload.xml;
  if (result.payload.kind === "lrc") return result.payload.synced ?? result.payload.plain;

  const response = await fetch(result.payload.fetchUrl, { signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch lyrics (${response.status})`);
  }
  const text = await response.text();
  if (text.length === 0) return null;
  return text;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

// -- Component ----------------------------------------------------------------

const LyricsImportModalShell: React.FC = () => {
  const { prefill, initialSection } = useImportModalState();
  const confirm = useConfirm();
  const agents = useProjectStore((s) => s.agents);
  const audioDuration = useAudioStore((s) => s.duration);
  const autoExtractBackgroundVocals = useSettingsStore((s) => s.autoExtractBackgroundVocals);
  const mergeStandaloneBackgroundLines = useSettingsStore((s) => s.mergeStandaloneBackgroundLines);

  const [currentSection, setCurrentSection] = useState<ImportModalSection>(initialSection ?? "search");
  const [pasteText, setPasteText] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [selectingResultId, setSelectingResultId] = useState<string | null>(null);
  const closedRef = useRef(false);
  const selectionAbortRef = useRef<AbortController | null>(null);

  const close = useCallback(() => {
    closedRef.current = true;
    if (selectionAbortRef.current !== null) {
      selectionAbortRef.current.abort();
      selectionAbortRef.current = null;
    }
    useImportModalStore.getState().close();
    setPasteText("");
    setPendingFile(null);
    setSelectingResultId(null);
  }, []);

  const buildContext = useCallback(
    (source: ImportSourceInfo): ImportParsedLyricsContext => ({
      confirm,
      agents,
      audioDuration,
      applyBackgroundExtraction: autoExtractBackgroundVocals,
      backgroundExtractionMergeStandalone: mergeStandaloneBackgroundLines,
      source,
      onResult: (parsed, src) => {
        useImportModalStore.getState().recordImportResult(parsed, src);
      },
    }),
    [agents, audioDuration, autoExtractBackgroundVocals, confirm, mergeStandaloneBackgroundLines],
  );

  const handleImportPaste = useCallback(async () => {
    if (pasteText.trim().length === 0) return;
    const defaultAgentId = agents?.[0]?.id ?? "v1";
    const lyricLines = textToLyricLines(pasteText, defaultAgentId);
    const parsed = wrapTextAsParseResult(lyricLines);
    const ok = await importParsedLyrics(parsed, buildContext({ label: "Paste", filename: "paste.txt" }));
    if (ok) close();
  }, [agents, buildContext, close, pasteText]);

  const handleImportUpload = useCallback(async () => {
    if (!pendingFile) return;
    const content = await pendingFile.text();
    const parsed = parseLyricsFile(pendingFile.name, content, audioDuration > 0 ? audioDuration : undefined);
    const ok = await importParsedLyrics(parsed, buildContext({ label: "File", filename: pendingFile.name }));
    if (ok) close();
  }, [audioDuration, buildContext, close, pendingFile]);

  const handleSearchSelect = useCallback(
    async (result: LyricsSearchResult) => {
      if (selectionAbortRef.current !== null) selectionAbortRef.current.abort();
      const controller = new AbortController();
      selectionAbortRef.current = controller;
      setSelectingResultId(result.id);

      let content: string | null;
      try {
        content = await payloadToContent(result, controller.signal);
      } catch (error) {
        if (selectionAbortRef.current === controller) selectionAbortRef.current = null;
        setSelectingResultId((prev) => (prev === result.id ? null : prev));
        if (isAbortError(error) || controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Failed to fetch lyrics";
        toast.error(`${result.sourceLabel}: ${message}`);
        return;
      }

      if (controller.signal.aborted || closedRef.current || !useImportModalStore.getState().isOpen) {
        if (selectionAbortRef.current === controller) selectionAbortRef.current = null;
        setSelectingResultId((prev) => (prev === result.id ? null : prev));
        return;
      }

      if (content === null) {
        if (selectionAbortRef.current === controller) selectionAbortRef.current = null;
        setSelectingResultId((prev) => (prev === result.id ? null : prev));
        return;
      }

      const filename = syntheticFilenameForResult(result);
      const parsed = parseLyricsFile(filename, content, audioDuration > 0 ? audioDuration : undefined);
      const ok = await importParsedLyrics(parsed, buildContext({ label: result.sourceLabel, filename }));
      if (selectionAbortRef.current === controller) selectionAbortRef.current = null;
      setSelectingResultId((prev) => (prev === result.id ? null : prev));
      if (ok) close();
    },
    [audioDuration, buildContext, close],
  );

  const handleFilePicked = useCallback((file: File) => {
    setPendingFile(file);
  }, []);

  const switchToSearch = useCallback(() => setCurrentSection("search"), []);
  const switchToPaste = useCallback(() => setCurrentSection("paste"), []);
  const switchToUpload = useCallback(() => setCurrentSection("upload"), []);

  const expectedDurationSec = audioDuration > 0 ? audioDuration : undefined;

  const sectionBody = useMemo(() => {
    if (currentSection === "search") {
      return (
        <SearchSection
          initialPrefill={prefill}
          expectedDurationSec={expectedDurationSec}
          onSelect={handleSearchSelect}
          onSwitchToPaste={switchToPaste}
          onSwitchToUpload={switchToUpload}
        />
      );
    }
    if (currentSection === "paste") {
      return (
        <PasteSection
          value={pasteText}
          onChange={setPasteText}
          onSwitchToSearch={switchToSearch}
          onSwitchToUpload={switchToUpload}
        />
      );
    }
    return (
      <UploadSection onFile={handleFilePicked} onSwitchToSearch={switchToSearch} onSwitchToPaste={switchToPaste} />
    );
  }, [
    currentSection,
    expectedDurationSec,
    handleFilePicked,
    handleSearchSelect,
    pasteText,
    prefill,
    switchToPaste,
    switchToSearch,
    switchToUpload,
  ]);

  const showImportButton = currentSection !== "search";
  const importDisabled =
    (currentSection === "paste" && pasteText.trim().length === 0) ||
    (currentSection === "upload" && pendingFile === null) ||
    selectingResultId !== null;

  const handleImportClick = currentSection === "paste" ? handleImportPaste : handleImportUpload;

  const pendingFileLabel = pendingFile ? pendingFile.name : null;

  return (
    <Modal isOpen onClose={close} title="Import Lyrics" className="max-w-lg">
      <div className="flex flex-col gap-4">
        {sectionBody}

        {pendingFileLabel && currentSection === "upload" && (
          <div className="text-xs text-composer-text-muted">
            Ready to import: <span className="text-composer-text-secondary select-text">{pendingFileLabel}</span>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={close}>
            Cancel
          </Button>
          {showImportButton && (
            <Button variant="primary" size="sm" hasIcon disabled={importDisabled} onClick={handleImportClick}>
              <IconFileImport size={16} />
              Import
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

// -- Exports ------------------------------------------------------------------

export { LyricsImportModalShell };
