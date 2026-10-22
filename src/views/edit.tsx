import type { LinkGroup } from "@/domain/group/template";
import { instanceCount, instanceOrdinal } from "@/domain/instance/enumerate";
import { backgroundFields } from "@/domain/line/background";
import type { LyricLine } from "@/domain/line/model";
import { LYRICS_FORMATS_PROSE } from "@/domain/lyrics-file/supported-formats";
import { remapWordTextsPreservingTiming } from "@/domain/word/remap-text";
import type { WordTiming } from "@/domain/word/timing";
import { useDualClickImport } from "@/hooks/useDualClickImport";
import { useConfirm } from "@/stores/confirm-store";
import { isAnyModalOpen } from "@/stores/escape-layer-stack";
import { useImportModal, useImportModalStore, useLastImportResult } from "@/stores/import-modal-store";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { historyShortcutAction } from "@/utils/history-shortcut";
import { Button } from "@/ui/button";
import { Scroll } from "@/ui/scroll";
import { extractBackgroundVocals, extractInlineFromLine } from "@/utils/background-vocal-extraction";
import { pluralWord, pluralize } from "@/utils/pluralize";
import { AgentManager } from "@/views/edit/agent-manager";
import { decideEditTextAction } from "@/views/edit/decide-edit-text-action";
import { detachInstancesFromLines } from "@/views/edit/diff-edit-text";
import { linesToEditText } from "@/views/edit/edit-text";
import { EditNotices } from "@/views/edit/edit-notices";
import { ImportSuccessBanner } from "@/views/edit/import-success-banner";
import { LinePreview, PreviewGroupHeader } from "@/views/edit/line-preview";
import { parseLyrics } from "@/views/edit/parse-lyrics";
import { useComposedTextareaChange, useEditTextCaret } from "@/views/edit/use-edit-text-caret";
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

// -- Components ---------------------------------------------------------------

const EditPanel: React.FC = () => {
  const textareaId = useId();
  const agents = useProjectStore((s) => s.agents);
  const lines = useProjectStore((s) => s.lines);
  const groups = useProjectStore((s) => s.groups);
  const activeTab = useProjectStore((s) => s.activeTab);
  const confirm = useConfirm();
  const openImportModal = useImportModal();
  const lastImportResult = useLastImportResult();
  const dropImportContext = useImportContext("Drop");
  const mergeStandaloneBackgroundLines = useSettingsStore((s) => s.mergeStandaloneBackgroundLines);
  const preserveBracketsOnExtraction = useSettingsStore((s) => s.preserveBracketsOnExtraction);

  const [rawText, setRawText] = useState(() => linesToEditText(lines));
  const rawTextRef = useRef(rawText);
  rawTextRef.current = rawText;
  const { textareaRef, showEditText } = useEditTextCaret(rawText, setRawText);
  const linesSetByUs = useRef<LyricLine[] | null>(null);
  const modalPendingRef = useRef(false);
  const pastedRef = useRef(false);
  const runBaselineRef = useRef<{ lines: LyricLine[]; wasDirty: boolean } | null>(null);
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
  const instanceCountByGroup = useMemo(
    () => new Map(groups.map((g) => [g.id, instanceCount(lines, g.id)])),
    [groups, lines],
  );

  const extractOptions = useMemo(
    () => ({
      mergeStandaloneLines: mergeStandaloneBackgroundLines,
      preserveBrackets: preserveBracketsOnExtraction,
    }),
    [mergeStandaloneBackgroundLines, preserveBracketsOnExtraction],
  );
  const canExtractBackgroundVocals = useMemo(() => {
    const extracted = extractBackgroundVocals(lines, extractOptions);
    return extracted.length !== lines.length || extracted.some((line, i) => line !== lines[i]);
  }, [lines, extractOptions]);

  const commitLinesWithHistory = useCallback((nextLines: LyricLine[], nextGroups?: LinkGroup[]) => {
    useProjectStore.getState().setLinesWithHistory(nextLines, nextGroups);
    const committed = useProjectStore.getState().lines;
    linesSetByUs.current = committed;
    setRawText(linesToEditText(committed));
  }, []);

  const handleExtractBackgroundVocals = useCallback(() => {
    const current = useProjectStore.getState().lines;
    const next = extractBackgroundVocals(current, extractOptions);
    if (next.length === current.length && next.every((line, i) => line === current[i])) return;
    commitLinesWithHistory(next);
  }, [extractOptions, commitLinesWithHistory]);

  const handleAgentChange = useCallback((lineId: string, agentId: string) => {
    useProjectStore.getState().updateLineWithHistory(lineId, { agentId });
  }, []);

  const handleBackgroundChange = useCallback((lineId: string, text: string) => {
    const newBgText = text || undefined;
    const target = useProjectStore.getState().lines.find((l) => l.id === lineId);

    let words: WordTiming[] | undefined;
    if (newBgText && target?.backgroundWords?.length) {
      words = remapWordTextsPreservingTiming(target.backgroundWords, newBgText);
    }

    useProjectStore
      .getState()
      .updateLineWithHistory(lineId, backgroundFields({ text: newBgText, words, source: "manual" }));
  }, []);

  const handleExtractLine = useCallback((lineId: string) => {
    const target = useProjectStore.getState().lines.find((line) => line.id === lineId);
    if (!target) return;
    const extracted = extractInlineFromLine(target, {
      mergeStandaloneLines: false,
      preserveBrackets: useSettingsStore.getState().preserveBracketsOnExtraction,
    });
    if (extracted === target) return;
    useProjectStore.getState().updateLineWithHistory(lineId, {
      text: extracted.text,
      words: extracted.words,
      ...backgroundFields({
        text: extracted.backgroundText,
        words: extracted.backgroundWords,
        source: extracted.backgroundTextSource ?? "manual",
      }),
    });
  }, []);

  const handleLineSelect = useCallback((lineNumber: number, shiftKey: boolean) => {
    const anchor = lastSelectedLineRef.current;
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
      const updates = [...selectedLineIds].map((id) => ({ id: id as string, updates: { agentId } }));
      useProjectStore.getState().updateLinesWithHistory(updates);
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
    const baseline = runBaselineRef.current;
    if (baseline) {
      runBaselineRef.current = null;
      useProjectStore.getState().commitPendingLineEdit(baseline.lines, baseline.wasDirty);
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
    if (!useSettingsStore.getState().autoExtractBackgroundVocals) return;
    const current = useProjectStore.getState().lines;
    const next = extractBackgroundVocals(current, {
      mergeStandaloneLines: useSettingsStore.getState().mergeStandaloneBackgroundLines,
      preserveBrackets: useSettingsStore.getState().preserveBracketsOnExtraction,
    });
    if (next.length === current.length && next.every((line, i) => line === current[i])) return;
    commitLinesWithHistory(next);
  }, [commitLinesWithHistory, finalizeRun]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== "edit") return;
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
  }, [activeTab, textareaId, finalizeRun]);

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
        if (textarea.value !== rawTextRef.current) {
          textarea.value = rawTextRef.current;
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
          const detached = detachInstancesFromLines(action.lyricLines, action.impacted);
          const remainingGroupIds = new Set(detached.flatMap((l) => (l.groupId ? [l.groupId] : [])));
          const nextGroups = groups.filter((g) => remainingGroupIds.has(g.id));
          finalizeRun();
          commitLinesWithHistory(detached, nextGroups);
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
        if (useSettingsStore.getState().autoExtractBackgroundVocals) {
          finalLines = extractBackgroundVocals(finalLines, {
            mergeStandaloneLines: useSettingsStore.getState().mergeStandaloneBackgroundLines,
            preserveBrackets: useSettingsStore.getState().preserveBracketsOnExtraction,
          });
        }
        finalizeRun();
        commitLinesWithHistory(finalLines);
        return;
      }

      showEditText(text, action.editText, textarea);

      if (runBaselineRef.current === null) {
        const projectState = useProjectStore.getState();
        runBaselineRef.current = { lines: projectState.lines, wasDirty: projectState.isDirtySinceHistory };
      }
      linesSetByUs.current = finalLines;
      useProjectStore.getState().setLines(finalLines);
      scheduleRunFinalize();
    },
    [confirm, defaultAgentId, groups, lines, scheduleRunFinalize, commitLinesWithHistory, finalizeRun, showEditText],
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
              className="flex items-center h-7 mb-2 text-[13px] font-medium select-none text-(--label)"
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
            <Scroll className="flex-1 border rounded-xl border-(--edge) bg-(--well)">
              {parsed.length === 0 || (parsed.length === 1 && parsed[0].isEmpty) ? (
                <div className="flex items-center justify-center h-full text-sm text-(--muted)">
                  Lyrics will appear here
                </div>
              ) : (
                <div>
                  {parsed.map((line, index) => {
                    const prev = index > 0 ? parsed[index - 1] : null;
                    const isFirstOfInstance =
                      line.groupId !== undefined &&
                      line.instanceIdx !== undefined &&
                      (prev?.groupId !== line.groupId || prev?.instanceIdx !== line.instanceIdx);
                    const group = line.groupId ? groups.find((g) => g.id === line.groupId) : undefined;
                    const totalInstances = group ? (instanceCountByGroup.get(group.id) ?? 0) : 0;
                    const groupTooltip =
                      group && totalInstances > 1
                        ? `Part of ${group.label} · linked to ${pluralize(totalInstances - 1, "other instance")}. Edits propagate.`
                        : undefined;
                    return (
                      <div key={line.lineNumber}>
                        {isFirstOfInstance && group && line.instanceIdx !== undefined && (
                          <PreviewGroupHeader
                            label={group.label}
                            ordinal={instanceOrdinal(lines, group.id, line.instanceIdx)}
                            total={totalInstances}
                            color={group.color}
                          />
                        )}
                        <LinePreview
                          line={line}
                          agents={agents}
                          isSelected={selectedLines.has(line.lineNumber)}
                          hasMultipleSelected={selectedLines.size > 1}
                          groupColor={group?.color}
                          groupTooltip={groupTooltip}
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
                    );
                  })}
                </div>
              )}
            </Scroll>
          </div>
        </div>
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { EditPanel };
