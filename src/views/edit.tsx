import { isLinked } from "@/domain/instance/predicates";
import { useAudioStore } from "@/stores/audio";
import { useConfirm } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { getAgentColor } from "@/domain/agent/colors";
import type { LyricLine } from "@/domain/line/model";
import { Button } from "@/ui/button";
import { Popover } from "@/ui/popover";
import { Scroll } from "@/ui/scroll";
import { extractBackgroundVocals } from "@/utils/background-vocal-extraction";
import { type ParseResult, parseLyricsFile } from "@/utils/lyrics-parsers";
import { remapWordTextsPreservingTiming } from "@/utils/lyrics-text";
import { stripSplitCharacter } from "@/utils/split-character";
import { AgentManager } from "@/views/edit/agent-manager";
import { decideEditTextAction } from "@/views/edit/decide-edit-text-action";
import { detachInstancesFromLines } from "@/views/edit/diff-edit-text";
import { parseLyrics } from "@/views/edit/parse-lyrics";
import type { ParsedLine } from "@/views/edit/parse-lyrics";
import { IconAlertTriangle, IconFileImport, IconMicrophone, IconX } from "@tabler/icons-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

// -- Components ---------------------------------------------------------------

const BracketWarning: React.FC<{ count: number }> = ({ count }) => {
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-composer-error/10 text-composer-error">
      <IconAlertTriangle className="size-4 shrink-0" />
      <span>
        {count} line{count > 1 ? "s" : ""} contain{count === 1 ? "s" : ""} [brackets]
      </span>
    </div>
  );
};

const ImportSuccessBanner: React.FC<{
  result: ParseResult;
  filename: string;
  onDismiss: () => void;
}> = ({ result, filename, onDismiss }) => {
  const lineCount = result.lines.length;
  const timedLineCount = result.lines.filter((l) => l.begin !== undefined).length;
  const wordTimedCount = result.lines.filter((l) => l.words?.length).length;

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg bg-composer-accent/10 text-composer-accent-text">
      <div className="flex items-center gap-2">
        <IconFileImport className="size-4 shrink-0" />
        <span>
          Imported {lineCount} lines from {filename}
          {result.hasTimingData && (
            <> with {wordTimedCount > 0 ? `${wordTimedCount} word-timed` : `${timedLineCount} timed`} lines</>
          )}
        </span>
      </div>
      <Button size="icon" variant="ghost" onClick={onDismiss} className="size-6">
        <IconX className="size-4" />
      </Button>
    </div>
  );
};

const LinePreview: React.FC<{
  line: ParsedLine;
  agents: { id: string; name?: string }[];
  isSelected: boolean;
  hasMultipleSelected: boolean;
  groupColor?: string;
  groupTooltip?: string;
  onSelect: (lineNumber: number, shiftKey: boolean) => void;
  onAgentChange: (lineId: string, agentId: string) => void;
  onBulkAgentChange: (agentId: string) => void;
  onBackgroundChange: (lineId: string, text: string) => void;
  onGutterMouseDown: (lineNumber: number, e: React.MouseEvent) => void;
  onGutterMouseEnter: (lineNumber: number, e: React.MouseEvent) => void;
  didDragRef: React.MutableRefObject<boolean>;
}> = ({
  line,
  agents,
  isSelected,
  hasMultipleSelected,
  groupColor,
  groupTooltip,
  onSelect,
  onAgentChange,
  onBulkAgentChange,
  onBackgroundChange,
  onGutterMouseDown,
  onGutterMouseEnter,
  didDragRef,
}) => {
  const [bgInput, setBgInput] = useState(line.backgroundText ?? "");
  const agentColor = getAgentColor(line.agentId);

  const handleBgBlur = useCallback(() => {
    if (line.lineId) {
      onBackgroundChange(line.lineId, bgInput);
    }
  }, [line.lineId, bgInput, onBackgroundChange]);

  const selectLineForBulkEdit = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("select, button")) return;
      if (e.shiftKey) window.getSelection()?.removeAllRanges();
      onSelect(line.lineNumber, e.shiftKey);
    },
    [line.lineNumber, onSelect],
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!e.shiftKey) return;
    if ((e.target as HTMLElement).closest("select, button")) return;
    e.preventDefault();
  }, []);

  const handleGutterClick = useCallback(
    (e: React.MouseEvent) => {
      if (didDragRef.current) {
        didDragRef.current = false;
        e.stopPropagation();
      }
    },
    [didDragRef],
  );

  if (line.isEmpty) {
    return (
      <div className="flex items-baseline gap-2 px-3 py-0.5 opacity-50">
        <span
          className="w-8 font-mono text-xs text-right shrink-0 text-composer-text-muted tabular-nums select-none"
          onMouseEnter={(e) => onGutterMouseEnter(line.lineNumber, e)}
        >
          {line.lineNumber}
        </span>
        <span className="flex-1 text-sm italic text-composer-text-muted">(empty line)</span>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={-1}
      className={`relative flex items-center gap-2 px-3 py-0.5 group cursor-pointer ${
        isSelected ? "bg-composer-accent/15" : line.hasBrackets ? "bg-composer-error/5" : "hover:bg-composer-button/30"
      }`}
      onMouseDown={handleMouseDown}
      onClick={selectLineForBulkEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSelect(line.lineNumber, e.shiftKey);
      }}
      title={groupTooltip}
    >
      {groupColor && (
        <span
          aria-hidden
          className="absolute top-0 bottom-0 left-0 w-0.5 pointer-events-none"
          style={{ backgroundColor: groupColor }}
        />
      )}
      <span
        role="button"
        tabIndex={-1}
        className="w-8 font-mono text-xs text-right shrink-0 text-composer-text-muted tabular-nums select-none cursor-pointer"
        onMouseDown={(e) => onGutterMouseDown(line.lineNumber, e)}
        onMouseEnter={(e) => onGutterMouseEnter(line.lineNumber, e)}
        onClick={handleGutterClick}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleGutterClick(e as unknown as React.MouseEvent);
        }}
      >
        {line.lineNumber}
      </span>

      <span
        className={`text-sm ${line.hasBrackets ? "text-composer-error" : "text-composer-text"}`}
        style={{ borderLeft: `2px solid ${agentColor}`, paddingLeft: "6px" }}
      >
        {stripSplitCharacter(line.text)}
      </span>

      {line.backgroundText && <span className="text-xs italic text-composer-text-muted">{line.backgroundText}</span>}

      <div className="flex items-center gap-1.5 ml-auto transition-opacity opacity-0 group-hover:opacity-100">
        {agents.length > 1 && line.lineId && (
          <select
            value={line.agentId}
            onChange={(e) => {
              if (isSelected && hasMultipleSelected) {
                onBulkAgentChange(e.target.value);
              } else {
                onAgentChange(line.lineId, e.target.value);
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="h-5 px-1 text-xs border rounded cursor-pointer bg-composer-input border-composer-border focus:outline-none focus:border-composer-accent"
            style={{ borderLeftColor: agentColor, borderLeftWidth: "2px" }}
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name || agent.id}
              </option>
            ))}
          </select>
        )}

        {line.lineId && (
          <Popover
            placement="bottom-start"
            trigger={
              <button
                type="button"
                className="flex items-center gap-1 px-1.5 h-5 text-xs rounded cursor-pointer bg-composer-button hover:bg-composer-button-hover text-composer-text-muted hover:text-composer-text"
              >
                <IconMicrophone className="size-3" />
                BG
              </button>
            }
          >
            {(close) => (
              <div className="p-2 w-48">
                <p className="mb-1 text-xs text-composer-text-secondary">Background vocals</p>
                <input
                  type="text"
                  value={bgInput}
                  onChange={(e) => setBgInput(e.target.value)}
                  onBlur={handleBgBlur}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                      handleBgBlur();
                      close();
                    }
                  }}
                  placeholder="ooh, ah, etc."
                  className="w-full px-2 py-1 text-sm border rounded bg-composer-input border-composer-border focus:outline-none focus:border-composer-accent"
                />
              </div>
            )}
          </Popover>
        )}

        {line.hasTiming && <span className="text-xs text-composer-accent-text">synced</span>}
        {line.hasBrackets && <IconAlertTriangle className="size-4 text-composer-error" />}
      </div>
    </div>
  );
};

const EditPanel: React.FC = () => {
  const textareaId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const agents = useProjectStore((s) => s.agents);
  const lines = useProjectStore((s) => s.lines);
  const groups = useProjectStore((s) => s.groups);
  const setLines = useProjectStore((s) => s.setLines);
  const setMetadata = useProjectStore((s) => s.setMetadata);
  const addAgent = useProjectStore((s) => s.addAgent);
  const confirm = useConfirm();

  const [rawText, setRawText] = useState(() => (lines.length > 0 ? lines.map((l) => l.text).join("\n") : ""));
  const rawTextRef = useRef(rawText);
  rawTextRef.current = rawText;
  const linesSetByUs = useRef<LyricLine[] | null>(null);
  const modalPendingRef = useRef(false);
  const [importResult, setImportResult] = useState<{
    result: ParseResult;
    filename: string;
  } | null>(null);
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [lastSelectedLine, setLastSelectedLine] = useState<number | null>(null);
  const dragAnchorRef = useRef<number | null>(null);
  const didDragRef = useRef(false);

  // Sync rawText when lines change externally (persistence restore, project import, etc.)
  useEffect(() => {
    if (linesSetByUs.current === lines) {
      linesSetByUs.current = null;
      return;
    }
    setRawText(lines.length > 0 ? lines.map((l) => l.text).join("\n") : "");
  }, [lines]);

  const defaultAgentId = agents?.[0]?.id ?? "v1";
  const parsed = useMemo(() => parseLyrics(rawText, lines, defaultAgentId), [rawText, lines, defaultAgentId]);
  const bracketCount = useMemo(() => parsed.filter((p) => p.hasBrackets).length, [parsed]);
  const nonEmptyCount = useMemo(() => parsed.filter((p) => !p.isEmpty).length, [parsed]);
  const instanceCountByGroup = useMemo(() => {
    const indices = new Map<string, Set<number>>();
    for (const l of lines) {
      if (isLinked(l)) {
        let set = indices.get(l.groupId);
        if (!set) {
          set = new Set();
          indices.set(l.groupId, set);
        }
        set.add(l.instanceIdx);
      }
    }
    const counts = new Map<string, number>();
    for (const [k, v] of indices) counts.set(k, v.size);
    return counts;
  }, [lines]);

  const mergeStandalone = useSettingsStore((s) => s.mergeStandaloneBackgroundLines);
  const extractOptions = useMemo(() => ({ mergeStandaloneLines: mergeStandalone }), [mergeStandalone]);
  const canExtractBackgroundVocals = useMemo(() => {
    const extracted = extractBackgroundVocals(lines, extractOptions);
    return extracted.length !== lines.length || extracted.some((line, i) => line !== lines[i]);
  }, [lines, extractOptions]);

  const handleExtractBackgroundVocals = useCallback(() => {
    const current = useProjectStore.getState().lines;
    const next = extractBackgroundVocals(current, extractOptions);
    if (next.length === current.length && next.every((line, i) => line === current[i])) return;
    linesSetByUs.current = next;
    useProjectStore.getState().setLinesWithHistory(next);
    setRawText(next.map((line) => line.text).join("\n"));
  }, [extractOptions]);

  const handleAgentChange = useCallback((lineId: string, agentId: string) => {
    useProjectStore.getState().updateLineWithHistory(lineId, { agentId });
  }, []);

  const handleBackgroundChange = useCallback((lineId: string, text: string) => {
    const newBgText = text || undefined;
    const target = useProjectStore.getState().lines.find((l) => l.id === lineId);

    const updates: Partial<LyricLine> = { backgroundText: newBgText };
    if (newBgText && target?.backgroundWords?.length) {
      const remapped = remapWordTextsPreservingTiming(target.backgroundWords, newBgText);
      if (remapped) updates.backgroundWords = remapped;
      else updates.backgroundWords = undefined;
    } else if (!newBgText) {
      updates.backgroundWords = undefined;
    }

    useProjectStore.getState().updateLineWithHistory(lineId, updates);
  }, []);

  const handleLineSelect = useCallback(
    (lineNumber: number, shiftKey: boolean) => {
      setSelectedLines((prev) => {
        const next = new Set(prev);
        if (shiftKey && lastSelectedLine !== null) {
          const start = Math.min(lastSelectedLine, lineNumber);
          const end = Math.max(lastSelectedLine, lineNumber);
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
      setLastSelectedLine(lineNumber);
    },
    [lastSelectedLine],
  );

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
    setLastSelectedLine(lineNumber);
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

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
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
        if (e.target.value !== rawTextRef.current) {
          e.target.value = rawTextRef.current;
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
            ? `${action.impacted.length} instance${action.impacted.length === 1 ? "" : "s"}`
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
          linesSetByUs.current = detached;
          setLines(detached);
          if (nextGroups.length !== groups.length) {
            useProjectStore.getState().setGroups(nextGroups);
          }
          setRawText(detached.map((l) => l.text).join("\n"));
        });
        return;
      }

      setRawText(text);
      setImportResult(null);

      if (action.kind === "noop") return;

      linesSetByUs.current = action.finalLines;
      setLines(action.finalLines);
    },
    [confirm, defaultAgentId, groups, lines, setLines],
  );

  const handleFileImport = useCallback(
    async (file: File) => {
      const content = await file.text();
      const audioDuration = useAudioStore.getState().duration;
      const result = parseLyricsFile(file.name, content, audioDuration > 0 ? audioDuration : undefined);

      if (result.lines.length > 0) {
        const existingLineCount = useProjectStore.getState().lines.length;
        if (existingLineCount > 0) {
          const ok = await confirm({
            title: "Replace existing lyrics?",
            description: `This will replace your ${existingLineCount} existing line${existingLineCount === 1 ? "" : "s"}. This cannot be undone.`,
            confirmLabel: "Replace",
            variant: "destructive",
            settingsKey: "confirmReplaceLyrics",
          });
          if (!ok) return;
        }

        linesSetByUs.current = result.lines;
        setLines(result.lines);
        setRawText(result.lines.map((l) => l.text).join("\n"));
        useProjectStore.getState().setGroups(result.groups ?? []);

        if (Object.keys(result.metadata).length > 0) {
          setMetadata(result.metadata);
        }

        // Reconcile imported agents: update name/type on matching id, add otherwise
        if (result.agents?.length) {
          const updateAgent = useProjectStore.getState().updateAgent;
          const agentsById = new Map(agents.map((a) => [a.id, a] as const));
          for (const agent of result.agents) {
            if (agentsById.has(agent.id)) {
              updateAgent(agent.id, { name: agent.name, type: agent.type });
            } else {
              addAgent(agent);
            }
          }
        }

        setImportResult({ result, filename: file.name });
      }
    },
    [setLines, setMetadata, agents, addAgent, confirm],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileImport(file);
      }
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [handleFileImport],
  );

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && /\.(txt|lrc|srt|ttml|xml)$/i.test(file.name)) {
        handleFileImport(file);
      }
    },
    [handleFileImport],
  );

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  return (
    <div
      data-tour="edit-panel"
      className="flex flex-col flex-1 gap-4 p-4 overflow-hidden"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <div className="flex items-center justify-between select-none">
        <h2 className="text-lg font-medium">Lyrics Editor</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-composer-text-muted">
            {nonEmptyCount} line{nonEmptyCount !== 1 ? "s" : ""}
          </span>
          <Button
            hasIcon
            variant="secondary"
            onClick={handleExtractBackgroundVocals}
            disabled={!canExtractBackgroundVocals}
          >
            <IconMicrophone className="size-4" />
            Extract background vocals
          </Button>
          <Button hasIcon onClick={handleImportClick}>
            <IconFileImport className="size-4" />
            Import File
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.lrc,.srt,.ttml,.xml"
            onChange={handleFileInputChange}
            className="sr-only"
          />
        </div>
      </div>

      {importResult && (
        <ImportSuccessBanner
          result={importResult.result}
          filename={importResult.filename}
          onDismiss={() => setImportResult(null)}
        />
      )}

      <BracketWarning count={bracketCount} />

      <AgentManager />

      <div className="flex flex-1 min-h-0 gap-4">
        {/* Input */}
        <div className="flex flex-col flex-1 min-w-0">
          <label htmlFor={textareaId} className="mb-2 text-sm font-medium select-none text-composer-text-secondary">
            Paste or type lyrics
          </label>
          <textarea
            id={textareaId}
            value={rawText}
            onChange={handleTextChange}
            placeholder="Paste your lyrics here, one line at a time...

Or drag and drop a lyrics file (.txt, .lrc, .srt, .ttml)"
            className="flex-1 p-3 text-sm border rounded-lg resize-none bg-composer-input border-composer-border focus:outline-none focus:border-composer-accent placeholder:text-composer-text-muted"
            spellCheck={false}
          />
        </div>

        {/* Preview */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center justify-between h-5 mb-2">
            <span className="text-sm font-medium select-none text-composer-text-secondary">Preview</span>
            <div
              className={`flex items-center gap-2 transition-opacity ${selectedLines.size > 0 ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            >
              <span className="text-xs text-composer-text-muted">
                {selectedLines.size} line{selectedLines.size !== 1 ? "s" : ""} selected
              </span>
              {agents.length > 1 && (
                <select
                  onChange={(e) => handleBulkAgentChange(e.target.value)}
                  value=""
                  className="h-6 px-1.5 text-xs border rounded cursor-pointer bg-composer-input border-composer-border focus:outline-none focus:border-composer-accent"
                >
                  <option value="" disabled>
                    Assign agent
                  </option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name || agent.id}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-xs cursor-pointer text-composer-text-muted hover:text-composer-text"
              >
                Clear
              </button>
            </div>
          </div>
          <Scroll className="flex-1 border rounded-lg border-composer-border bg-composer-bg-dark">
            {parsed.length === 0 || (parsed.length === 1 && parsed[0].isEmpty) ? (
              <div className="flex items-center justify-center h-full text-sm text-composer-text-muted">
                Lyrics will appear here
              </div>
            ) : (
              <div className="py-2">
                {parsed.map((line, index) => {
                  const prev = index > 0 ? parsed[index - 1] : null;
                  const next = index < parsed.length - 1 ? parsed[index + 1] : null;
                  const isFirstOfInstance =
                    line.groupId !== undefined &&
                    line.instanceIdx !== undefined &&
                    (prev?.groupId !== line.groupId || prev?.instanceIdx !== line.instanceIdx);
                  const isLastOfInstance =
                    line.groupId !== undefined &&
                    line.instanceIdx !== undefined &&
                    (next?.groupId !== line.groupId || next?.instanceIdx !== line.instanceIdx);
                  const group = line.groupId ? groups.find((g) => g.id === line.groupId) : undefined;
                  const totalInstances = group ? (instanceCountByGroup.get(group.id) ?? 0) : 0;
                  const groupTooltip =
                    group && totalInstances > 1
                      ? `Part of ${group.label} · linked to ${totalInstances - 1} other instance${totalInstances - 1 === 1 ? "" : "s"}. Edits propagate.`
                      : undefined;
                  return (
                    <div key={line.lineNumber}>
                      {isFirstOfInstance && group && (
                        <div
                          className="mx-3 mt-2 mb-1 flex items-center gap-2 text-xs text-composer-text-muted select-none"
                          aria-hidden
                        >
                          <span className="font-medium text-composer-text">{group.label}</span>
                          <span className="tabular-nums">
                            · {(line.instanceIdx ?? 0) + 1} of {totalInstances}
                          </span>
                          <span className="flex-1 h-px" style={{ backgroundColor: group.color, opacity: 0.4 }} />
                        </div>
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
                        onGutterMouseDown={handleGutterMouseDown}
                        onGutterMouseEnter={handleGutterMouseEnter}
                        didDragRef={didDragRef}
                      />
                      {isLastOfInstance && group && (
                        <div className="mx-3 mt-1 mb-2 flex items-center select-none" aria-hidden>
                          <span className="flex-1 h-px" style={{ backgroundColor: group.color, opacity: 0.4 }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Scroll>
        </div>
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { EditPanel };
