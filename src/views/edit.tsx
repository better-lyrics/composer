import { getAgentColor, useProjectStore } from "@/stores/project";
import type { LyricLine } from "@/stores/project";
import { Button } from "@/ui/button";
import { Popover } from "@/ui/popover";
import { type ParseResult, parseLyricsFile } from "@/utils/lyrics-parsers";
import { textToLyricLines } from "@/utils/lyrics-text";
import { stripPipes } from "@/utils/sync-helpers";
import { AgentManager } from "@/views/edit/agent-manager";
import { IconAlertTriangle, IconFileImport, IconMicrophone, IconX } from "@tabler/icons-react";
import { useCallback, useId, useMemo, useRef, useState } from "react";

// -- Types --------------------------------------------------------------------

interface ParsedLine {
  lineNumber: number;
  lineId: string;
  text: string;
  isEmpty: boolean;
  hasBrackets: boolean;
  hasTiming: boolean;
  agentId: string;
  backgroundText?: string;
}

// -- Helpers ------------------------------------------------------------------

function parseLyrics(text: string, lines: LyricLine[], defaultAgentId: string): ParsedLine[] {
  const textLines = text.split("\n");
  let nonEmptyIndex = 0;

  return textLines.map((line, index) => {
    const trimmed = line.trim();
    const isEmpty = trimmed === "";

    // Match non-empty lines to stored lines by index (skipping empty lines)
    const lyricLine = isEmpty ? undefined : lines[nonEmptyIndex++];
    const hasTiming = lyricLine?.begin !== undefined || (lyricLine?.words?.length ?? 0) > 0;

    return {
      lineNumber: index + 1,
      lineId: lyricLine?.id ?? "",
      text: lyricLine?.text ?? line,
      isEmpty,
      hasBrackets: /\[.*?\]/.test(line),
      hasTiming,
      agentId: lyricLine?.agentId ?? defaultAgentId,
      backgroundText: lyricLine?.backgroundText,
    };
  });
}

// -- Components ---------------------------------------------------------------

const BracketWarning: React.FC<{ count: number }> = ({ count }) => {
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-composer-error/10 text-composer-error">
      <IconAlertTriangle className="w-4 h-4 shrink-0" />
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
        <IconFileImport className="w-4 h-4 shrink-0" />
        <span>
          Imported {lineCount} lines from {filename}
          {result.hasTimingData && (
            <> with {wordTimedCount > 0 ? `${wordTimedCount} word-timed` : `${timedLineCount} timed`} lines</>
          )}
        </span>
      </div>
      <Button size="icon" variant="ghost" onClick={onDismiss} className="h-6 w-6">
        <IconX className="w-4 h-4" />
      </Button>
    </div>
  );
};

const LinePreview: React.FC<{
  line: ParsedLine;
  agents: { id: string; name?: string }[];
  isSelected: boolean;
  hasMultipleSelected: boolean;
  onSelect: (lineNumber: number, shiftKey: boolean) => void;
  onAgentChange: (lineId: string, agentId: string) => void;
  onBulkAgentChange: (agentId: string) => void;
  onBackgroundChange: (lineId: string, text: string) => void;
}> = ({
  line,
  agents,
  isSelected,
  hasMultipleSelected,
  onSelect,
  onAgentChange,
  onBulkAgentChange,
  onBackgroundChange,
}) => {
  const [bgInput, setBgInput] = useState(line.backgroundText ?? "");
  const agentColor = getAgentColor(line.agentId);

  const handleBgBlur = useCallback(() => {
    if (line.lineId) {
      onBackgroundChange(line.lineId, bgInput);
    }
  }, [line.lineId, bgInput, onBackgroundChange]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("select, button")) return;
      onSelect(line.lineNumber, e.altKey);
    },
    [line.lineNumber, onSelect],
  );

  if (line.isEmpty) {
    return (
      <div className="flex items-baseline gap-2 px-3 py-0.5 opacity-50">
        <span className="w-8 font-mono text-xs text-right shrink-0 text-composer-text-muted tabular-nums">
          {line.lineNumber}
        </span>
        <span className="flex-1 text-sm italic text-composer-text-muted">(empty line)</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-0.5 group cursor-pointer ${
        isSelected ? "bg-composer-accent/15" : line.hasBrackets ? "bg-composer-error/5" : "hover:bg-composer-button/30"
      }`}
      onClick={handleClick}
    >
      <span className="w-8 font-mono text-xs text-right shrink-0 text-composer-text-muted tabular-nums">
        {line.lineNumber}
      </span>

      <span
        className={`text-sm ${line.hasBrackets ? "text-composer-error" : "text-composer-text"}`}
        style={{ borderLeft: `2px solid ${agentColor}`, paddingLeft: "6px" }}
      >
        {stripPipes(line.text)}
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
                <IconMicrophone className="w-3 h-3" />
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
        {line.hasBrackets && <IconAlertTriangle className="w-4 h-4 text-composer-error" />}
      </div>
    </div>
  );
};

const EditPanel: React.FC = () => {
  const textareaId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const agents = useProjectStore((s) => s.agents);
  const lines = useProjectStore((s) => s.lines);
  const setLines = useProjectStore((s) => s.setLines);
  const setMetadata = useProjectStore((s) => s.setMetadata);
  const updateLine = useProjectStore((s) => s.updateLine);
  const addAgent = useProjectStore((s) => s.addAgent);

  const [rawText, setRawText] = useState("");
  const [importResult, setImportResult] = useState<{
    result: ParseResult;
    filename: string;
  } | null>(null);
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [lastSelectedLine, setLastSelectedLine] = useState<number | null>(null);

  const defaultAgentId = agents[0]?.id ?? "v1";
  const parsed = useMemo(() => parseLyrics(rawText, lines, defaultAgentId), [rawText, lines, defaultAgentId]);
  const bracketCount = useMemo(() => parsed.filter((p) => p.hasBrackets).length, [parsed]);
  const nonEmptyCount = useMemo(() => parsed.filter((p) => !p.isEmpty).length, [parsed]);

  const handleAgentChange = useCallback(
    (lineId: string, agentId: string) => {
      updateLine(lineId, { agentId });
    },
    [updateLine],
  );

  const handleBackgroundChange = useCallback(
    (lineId: string, text: string) => {
      updateLine(lineId, { backgroundText: text || undefined });
    },
    [updateLine],
  );

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

  const handleBulkAgentChange = useCallback(
    (agentId: string) => {
      const selectedLineIds = parsed.filter((p) => selectedLines.has(p.lineNumber) && p.lineId).map((p) => p.lineId);

      const updatedLines = lines.map((line) => (selectedLineIds.includes(line.id) ? { ...line, agentId } : line));
      setLines(updatedLines);
      setSelectedLines(new Set());
    },
    [parsed, selectedLines, lines, setLines],
  );

  const handleClearSelection = useCallback(() => {
    setSelectedLines(new Set());
  }, []);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      setRawText(text);

      const lyricLines = textToLyricLines(text, defaultAgentId, lines);
      setLines(lyricLines);
      setImportResult(null);
    },
    [defaultAgentId, lines, setLines],
  );

  const handleFileImport = useCallback(
    async (file: File) => {
      const content = await file.text();
      const result = parseLyricsFile(file.name, content);

      if (result.lines.length > 0) {
        setLines(result.lines);
        setRawText(result.lines.map((l) => l.text).join("\n"));

        if (Object.keys(result.metadata).length > 0) {
          setMetadata(result.metadata);
        }

        // Add imported agents (skip duplicates)
        if (result.agents?.length) {
          for (const agent of result.agents) {
            if (!agents.find((a) => a.id === agent.id)) {
              addAgent(agent);
            }
          }
        }

        setImportResult({ result, filename: file.name });
      }
    },
    [setLines, setMetadata, agents, addAgent],
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
          <Button hasIcon onClick={handleImportClick}>
            <IconFileImport className="w-4 h-4" />
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
          <div className="flex-1 overflow-y-auto border rounded-lg border-composer-border bg-composer-bg-dark">
            {parsed.length === 0 || (parsed.length === 1 && parsed[0].isEmpty) ? (
              <div className="flex items-center justify-center h-full text-sm text-composer-text-muted">
                Lyrics will appear here
              </div>
            ) : (
              <div className="py-2">
                {parsed.map((line) => (
                  <LinePreview
                    key={line.lineNumber}
                    line={line}
                    agents={agents}
                    isSelected={selectedLines.has(line.lineNumber)}
                    hasMultipleSelected={selectedLines.size > 1}
                    onSelect={handleLineSelect}
                    onAgentChange={handleAgentChange}
                    onBulkAgentChange={handleBulkAgentChange}
                    onBackgroundChange={handleBackgroundChange}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { EditPanel };
