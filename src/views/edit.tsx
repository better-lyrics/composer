import type { LyricCommand } from "@/domain/commands/command";
import {
  applyEditTextDetaching,
  editBackgroundText,
  extractBackground,
  extractLineBackground,
  pasteLyrics,
  typeLyrics,
} from "@/domain/commands/edit-text";
import { assignSinger } from "@/domain/commands/singer";
import { detectNonLatinLanguage } from "@/domain/language/script-detection";
import { hasLyricLines } from "@/domain/project/lyrics-presence";
import type { LyricLine } from "@/domain/line/model";
import { LYRICS_FORMATS_PROSE } from "@/domain/lyrics-file/supported-formats";
import { useIsActiveTab } from "@/hooks/use-is-active-tab";
import { useDualClickImport } from "@/hooks/useDualClickImport";
import { noteGuideSignal } from "@/lib/guide-signals";
import { useConfirm } from "@/stores/confirm-store";
import { isAnyModalOpen } from "@/stores/escape-layer-stack";
import { useImportModal, useImportModalStore, useLastImportResult } from "@/stores/import-modal-store";
import { useProjectStore } from "@/stores/project";
import type { LyricBurst } from "@/stores/project/history-types";
import { useSettingsStore } from "@/stores/settings";
import { historyShortcutAction } from "@/utils/history-shortcut";
import { Button } from "@/ui/button";
import { extractBackgroundVocals, lineHasInlineParens } from "@/utils/background-vocal-extraction";
import { pluralWord, pluralize } from "@/utils/pluralize";
import { AgentManager } from "@/views/edit/agent-manager";
import { useCanExtractBackgroundVocals } from "@/views/edit/can-extract-background";
import { decideEditTextAction } from "@/domain/edit-text/decide-edit-text-action";
import { linesToEditText } from "@/domain/edit-text/edit-text";
import { EditNotices } from "@/views/edit/edit-notices";
import { ImportSuccessBanner } from "@/views/edit/import-success-banner";
import { LinePreviewList } from "@/views/edit/line-preview-list";
import { parseLyrics } from "@/views/edit/parse-lyrics";
import { useComposedTextareaChange, useEditTextCaret } from "@/views/edit/use-edit-text-caret";
import { useFocusLyricsShortcut } from "@/views/edit/use-focus-lyrics-shortcut";
import { useSmartPaste } from "@/views/edit/use-smart-paste";
import { PreviewSelectionBar } from "@/views/edit/preview-selection-bar";
import { PROJECT_FILE_PROSE } from "@/views/lyrics-import-modal/accepted-files";
import { useImportContext } from "@/views/lyrics-import-modal/import-lyrics";
import { importLyricsFile } from "@/views/lyrics-import-modal/import-lyrics-source";
import { IconFileImport, IconMicrophone } from "@tabler/icons-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

// -- Constants ----------------------------------------------------------------

const RUN_DEBOUNCE_MS = 500;

const LYRICS_TEXTAREA_PLACEHOLDER = `Paste your lyrics here, one line at a time...

Or paste or drop a whole lyrics file (${LYRICS_FORMATS_PROSE}) or ${PROJECT_FILE_PROSE} to import it`;

const preventDefaultDragOver = (e: React.DragEvent) => e.preventDefault();

const lyricsText = (lines: readonly LyricLine[]) => lines.map((line) => line.text).join("\n");

const noteTypedLyrics = (lines: readonly LyricLine[]) => {
  if (!hasLyricLines(lines)) return;
  noteGuideSignal("edit.type");
  const { splitCharacter } = useSettingsStore.getState();
  if (splitCharacter && lyricsText(lines).includes(splitCharacter)) noteGuideSignal("edit.presplit");
};

// -- Components ---------------------------------------------------------------

const EditPanel: React.FC = () => {
  const textareaId = useId();
  const agents = useProjectStore((s) => s.agents);
  const lines = useProjectStore((s) => s.lines);
  const groups = useProjectStore((s) => s.groups);
  const isActive = useIsActiveTab("edit");
  const confirm = useConfirm();
  const openImportModal = useImportModal();
  const lastImportResult = useLastImportResult();
  const dropImportContext = useImportContext("Drop");
  const mergeStandaloneBackgroundLines = useSettingsStore((s) => s.mergeStandaloneBackgroundLines);
  const preserveBracketsOnExtraction = useSettingsStore((s) => s.preserveBracketsOnExtraction);

  const [rawText, setRawText] = useState(() => linesToEditText(lines));
  const { textareaRef, showEditText } = useEditTextCaret(rawText, setRawText);
  useFocusLyricsShortcut(textareaRef, isActive);
  const linesSetByUs = useRef<LyricLine[] | null>(null);
  const modalPendingRef = useRef(false);
  const pastedRef = useRef(false);
  const runBurstRef = useRef<LyricBurst | null>(null);
  const debounceRef = useRef<number | null>(null);
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [isTypingLyrics, setIsTypingLyrics] = useState(false);
  const lastSelectedLineRef = useRef<number | null>(null);
  const dragAnchorRef = useRef<number | null>(null);
  const didDragRef = useRef(false);

  // Sync rawText when lines change externally (persistence restore, project import, etc.)
  useEffect(() => {
    if (linesSetByUs.current === lines) {
      linesSetByUs.current = null;
      return;
    }
    setRawText(linesToEditText(lines));
  }, [lines]);

  const defaultAgentId = agents?.[0]?.id ?? "v1";
  const parsed = useMemo(() => parseLyrics(rawText, lines, defaultAgentId), [rawText, lines, defaultAgentId]);
  const nonEmptyCount = useMemo(() => parsed.filter((p) => !p.isEmpty).length, [parsed]);

  const extractOptions = useMemo(
    () => ({
      mergeStandaloneLines: mergeStandaloneBackgroundLines,
      preserveBrackets: preserveBracketsOnExtraction,
    }),
    [mergeStandaloneBackgroundLines, preserveBracketsOnExtraction],
  );
  const canExtractBackgroundVocals = useCanExtractBackgroundVocals(lines, extractOptions);

  // Shows the committed lyrics in the textarea only when the command changed them.
  const commitAndShow = useCallback((command: LyricCommand): boolean => {
    const before = useProjectStore.getState().lines;
    useProjectStore.getState().commit(command);
    const committed = useProjectStore.getState().lines;
    if (committed === before) return false;
    linesSetByUs.current = committed;
    setRawText(linesToEditText(committed));
    return true;
  }, []);

  const handleExtractBackgroundVocals = useCallback(() => {
    if (!commitAndShow(extractBackground(extractOptions))) return;
    noteGuideSignal("edit.background");
    noteGuideSignal("edit.extractAll");
  }, [extractOptions, commitAndShow]);

  const handleAgentChange = useCallback((lineId: string, agentId: string) => {
    useProjectStore.getState().commit(assignSinger([lineId], agentId));
    noteGuideSignal("edit.singer");
    noteGuideSignal("edit.singerOneLine");
  }, []);

  const handleBackgroundChange = useCallback((lineId: string, text: string) => {
    useProjectStore.getState().commit(editBackgroundText(lineId, text));
    if (text) noteGuideSignal("edit.background");
  }, []);

  const handleExtractLine = useCallback((lineId: string) => {
    const before = useProjectStore.getState().lines;
    const preserveBrackets = useSettingsStore.getState().preserveBracketsOnExtraction;
    useProjectStore.getState().commit(extractLineBackground(lineId, preserveBrackets));
    if (useProjectStore.getState().lines === before) return;
    noteGuideSignal("edit.background");
    noteGuideSignal("edit.extractOneLine");
  }, []);

  const handleLineSelect = useCallback((lineNumber: number, shiftKey: boolean) => {
    const anchor = lastSelectedLineRef.current;
    if (shiftKey && anchor !== null) noteGuideSignal("edit.lineRange");
    setSelectedLines((prev) => {
      const next = new Set(prev);
      if (shiftKey && anchor !== null) {
        const start = Math.min(anchor, lineNumber);
        const end = Math.max(anchor, lineNumber);
        for (let i = start; i <= end; i++) {
          next.add(i);
        }
      } else {
        if (next.has(lineNumber)) {
          next.delete(lineNumber);
        } else {
          next.add(lineNumber);
        }
      }
      return next;
    });
    lastSelectedLineRef.current = lineNumber;
  }, []);

  const handleGutterMouseDown = useCallback((lineNumber: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    window.getSelection()?.removeAllRanges();
    dragAnchorRef.current = lineNumber;
    didDragRef.current = false;
  }, []);

  const handleGutterMouseEnter = useCallback((lineNumber: number, e: React.MouseEvent) => {
    const anchor = dragAnchorRef.current;
    if (anchor === null) return;
    if (e.buttons === 0) {
      dragAnchorRef.current = null;
      didDragRef.current = false;
      return;
    }
    if (!didDragRef.current) noteGuideSignal("edit.lineRange");
    didDragRef.current = true;
    const start = Math.min(anchor, lineNumber);
    const end = Math.max(anchor, lineNumber);
    const next = new Set<number>();
    for (let i = start; i <= end; i++) {
      next.add(i);
    }
    setSelectedLines(next);
    lastSelectedLineRef.current = lineNumber;
  }, []);

  const handleBulkAgentChange = useCallback(
    (agentId: string) => {
      const selectedLineIds = new Set(
        parsed.flatMap((p) => (selectedLines.has(p.lineNumber) && p.lineId ? [p.lineId] : [])),
      );
      useProjectStore.getState().commit(assignSinger([...selectedLineIds], agentId));
      noteGuideSignal("edit.singer");
      setSelectedLines(new Set());
    },
    [parsed, selectedLines],
  );

  const handleClearSelection = useCallback(() => {
    setSelectedLines(new Set());
  }, []);

  const finalizeRun = useCallback(() => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const burst = runBurstRef.current;
    if (burst) {
      runBurstRef.current = null;
      const { lines, closeLyricBurst } = useProjectStore.getState();
      closeLyricBurst(burst);
      noteTypedLyrics(lines);
    }
  }, []);

  const scheduleRunFinalize = useCallback(() => {
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      finalizeRun();
    }, RUN_DEBOUNCE_MS);
  }, [finalizeRun]);

  const handleTextareaBlur = useCallback(() => {
    setIsTypingLyrics(false);
    finalizeRun();
    const current = useProjectStore.getState().lines;
    if (detectNonLatinLanguage(lyricsText(current))) noteGuideSignal("edit.nonLatinLyrics");
    if (!useSettingsStore.getState().autoExtractBackgroundVocals) {
      if (current.some(lineHasInlineParens)) noteGuideSignal("edit.parenInLine");
      return;
    }
    const extracted = extractBackground({
      mergeStandaloneLines: useSettingsStore.getState().mergeStandaloneBackgroundLines,
      preserveBrackets: useSettingsStore.getState().preserveBracketsOnExtraction,
    });
    if (commitAndShow(extracted)) noteGuideSignal("edit.background");
  }, [commitAndShow, finalizeRun]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive) return;
      if (isAnyModalOpen()) return;
      const target = e.target as HTMLElement;
      if ((target.tagName === "INPUT" || target.tagName === "TEXTAREA") && target.id !== textareaId) return;
      const historyAction = historyShortcutAction(e, { redoOnY: true });
      if (!historyAction) return;
      e.preventDefault();
      finalizeRun();
      useProjectStore.getState()[historyAction]();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, textareaId, finalizeRun]);

  useEffect(() => () => finalizeRun(), [finalizeRun]);

  const applyTextareaText = useCallback(
    (textarea: HTMLTextAreaElement) => {
      const wasPaste = pastedRef.current;
      pastedRef.current = false;

      const text = textarea.value;
      const action = decideEditTextAction({
        text,
        defaultAgentId,
        lines,
        groups,
        modalPending: modalPendingRef.current,
      });

      // Snap the controlled DOM input back to the source-of-truth rawText whenever
      // we choose not to setRawText. Without this, React skips reconciling the
      // textarea on a state-less return path and the user's keystrokes persist
      // visually even though the store rejected them.
      const snapBack = () => {
        if (textarea.value !== rawText) {
          textarea.value = rawText;
        }
      };

      if (action.kind === "ignore-modal-pending") {
        snapBack();
        return;
      }

      if (action.kind === "needs-confirm") {
        snapBack();
        modalPendingRef.current = true;
        const labelText =
          action.labels.length === 0
            ? pluralize(action.impacted.length, "instance")
            : action.labels.length === 1
              ? `[${action.labels[0]}]`
              : action.labels.map((l) => `[${l}]`).join(", ");

        confirm({
          title: `Detach ${labelText} to apply this edit?`,
          description: `Adding or removing rows inside ${
            action.labels.length === 1 ? `the ${labelText} group` : "these groups"
          } will detach ${action.impacted.length === 1 ? "this instance" : "these instances"} from the link. Other instances stay linked.`,
          confirmLabel: "Detach and apply",
          variant: "destructive",
          recoverable: true,
        }).then((ok) => {
          modalPendingRef.current = false;
          if (!ok) return;
          finalizeRun();
          commitAndShow(applyEditTextDetaching(text, defaultAgentId));
        });
        return;
      }

      useImportModalStore.getState().clearImportResult();

      if (action.kind === "noop") {
        showEditText(text, text, textarea);
        return;
      }

      let finalLines = action.finalLines;

      if (wasPaste) {
        const pastedLines = finalLines;
        if (useSettingsStore.getState().autoExtractBackgroundVocals) {
          finalLines = extractBackgroundVocals(finalLines, {
            mergeStandaloneLines: useSettingsStore.getState().mergeStandaloneBackgroundLines,
            preserveBrackets: useSettingsStore.getState().preserveBracketsOnExtraction,
          });
        }
        finalizeRun();
        commitAndShow(pasteLyrics(lines, finalLines));
        noteTypedLyrics(finalLines);
        if (finalLines.length !== pastedLines.length || finalLines.some((line, i) => line !== pastedLines[i])) {
          noteGuideSignal("edit.background");
        }
        return;
      }

      showEditText(text, action.editText, textarea);

      runBurstRef.current ??= useProjectStore.getState().beginLyricBurst();
      linesSetByUs.current = finalLines;
      useProjectStore.getState().commit(typeLyrics(lines, finalLines), "pending");
      scheduleRunFinalize();
    },
    [confirm, defaultAgentId, groups, lines, rawText, scheduleRunFinalize, commitAndShow, finalizeRun, showEditText],
  );
  const textareaChange = useComposedTextareaChange(setRawText, applyTextareaText);
  const handlePaste = useSmartPaste({ typedPasteRef: pastedRef, onBeforeImport: finalizeRun });

  const importTriggers = useDualClickImport(openImportModal);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) void importLyricsFile(file, dropImportContext);
    },
    [dropImportContext],
  );

  return (
    <div
      data-tour="edit-panel"
      className="flex flex-col flex-1 overflow-hidden"
      onDrop={handleDrop}
      onDragOver={preventDefaultDragOver}
    >
      <div className="flex items-center justify-between gap-4 h-13 shrink-0 pl-5 pr-2 border-b border-(--divider) select-none">
        <div className="flex items-center gap-3 shrink-0">
          <h2 className="sr-only">Lyrics Editor</h2>
          <span className="flex items-baseline gap-1.5 text-[13px] text-(--muted) tabular-nums">
            <b className="font-mono text-[15px] font-bold text-composer-text">{nonEmptyCount}</b>{" "}
            {pluralWord(nonEmptyCount, "line", "lines")}
          </span>
          <AgentManager />
        </div>
        <div className="flex flex-1 min-w-0 items-center justify-end gap-3">
          <EditNotices parsed={parsed} isTyping={isTypingLyrics} />
          <Button
            hasIcon
            size="lg"
            data-guide-spot="extractAll"
            onClick={handleExtractBackgroundVocals}
            disabled={!canExtractBackgroundVocals}
            title={canExtractBackgroundVocals ? undefined : "No parentheses to extract"}
          >
            <IconMicrophone className="size-4" />
            Extract background vocals
          </Button>
          <Button
            hasIcon
            size="lg"
            data-tour="import-lyrics-button"
            data-guide-spot="importLyrics"
            onClick={importTriggers.onClick}
            onDoubleClick={importTriggers.onDoubleClick}
            title="Click to search, paste, or upload. Double-click to upload a file directly."
          >
            <IconFileImport className="size-4" />
            Import Lyrics
          </Button>
          {importTriggers.fileInput}
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0 gap-3 p-4">
        {lastImportResult && (
          <ImportSuccessBanner
            result={lastImportResult.parsed}
            filename={lastImportResult.source.filename}
            onDismiss={() => useImportModalStore.getState().clearImportResult()}
          />
        )}

        <div className="flex flex-1 min-h-0 gap-4">
          {/* Input */}
          <div className="flex flex-col flex-1 min-w-0">
            <label
              htmlFor={textareaId}
              className="flex items-center self-start h-7 mb-2 text-[13px] font-medium select-none text-(--label)"
            >
              Paste or type lyrics
            </label>
            {/* react-doctor-disable-next-line react-doctor/control-has-associated-label */}
            <textarea
              id={textareaId}
              ref={textareaRef}
              value={rawText}
              onChange={textareaChange.onChange}
              onFocus={() => setIsTypingLyrics(true)}
              onBlur={handleTextareaBlur}
              onCompositionStart={textareaChange.onCompositionStart}
              onCompositionEnd={textareaChange.onCompositionEnd}
              onPaste={handlePaste}
              placeholder={LYRICS_TEXTAREA_PLACEHOLDER}
              className="flex-1 py-2 px-3.5 text-sm font-medium leading-7 border rounded-xl resize-none bg-(--well) border-(--edge) caret-composer-accent focus:outline-none focus:border-(--lit-ring) placeholder:text-(--muted)"
              spellCheck={false}
            />
          </div>

          {/* Preview */}
          <div className="flex flex-col flex-1 min-w-0">
            <PreviewSelectionBar
              selectedCount={selectedLines.size}
              onAssignAgent={handleBulkAgentChange}
              onClear={handleClearSelection}
            />
            <LinePreviewList
              parsed={parsed}
              lines={lines}
              groups={groups}
              agents={agents}
              selectedLines={selectedLines}
              onSelect={handleLineSelect}
              onAgentChange={handleAgentChange}
              onBulkAgentChange={handleBulkAgentChange}
              onBackgroundChange={handleBackgroundChange}
              onExtractLine={handleExtractLine}
              onGutterMouseDown={handleGutterMouseDown}
              onGutterMouseEnter={handleGutterMouseEnter}
              didDragRef={didDragRef}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { EditPanel };
