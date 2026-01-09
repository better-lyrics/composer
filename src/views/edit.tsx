import { useProjectStore } from "@/stores/project";
import type { LyricLine } from "@/stores/project";
import { Button } from "@/ui/button";
import { type ParseResult, parseLyricsFile } from "@/utils/lyrics-parsers";
import { IconAlertTriangle, IconFileImport, IconX } from "@tabler/icons-react";
import { useCallback, useId, useMemo, useRef, useState } from "react";

// -- Types --------------------------------------------------------------------

interface ParsedLine {
  lineNumber: number;
  text: string;
  isEmpty: boolean;
  hasBrackets: boolean;
  hasTiming: boolean;
}

// -- Helpers ------------------------------------------------------------------

function parseLyrics(text: string, lines: LyricLine[]): ParsedLine[] {
  const textLines = text.split("\n");
  return textLines.map((line, index) => {
    const lyricLine = lines[index];
    const hasTiming = lyricLine?.begin !== undefined || (lyricLine?.words?.length ?? 0) > 0;
    return {
      lineNumber: index + 1,
      text: line,
      isEmpty: line.trim() === "",
      hasBrackets: /\[.*?\]/.test(line),
      hasTiming,
    };
  });
}

function textToLyricLines(text: string, defaultAgentId: string): LyricLine[] {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => ({
      id: crypto.randomUUID(),
      text: line.trim(),
      agentId: defaultAgentId,
    }));
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

const LinePreview: React.FC<{ line: ParsedLine }> = ({ line }) => {
  return (
    <div
      className={`flex items-baseline gap-2 px-3 py-0.5 ${
        line.isEmpty ? "opacity-50" : ""
      } ${line.hasBrackets ? "bg-composer-error/5" : ""}`}
    >
      <span className="w-8 font-mono text-xs text-right shrink-0 text-composer-text-muted tabular-nums">
        {line.lineNumber}
      </span>
      <span
        className={`flex-1 text-sm ${
          line.isEmpty ? "italic text-composer-text-muted" : "text-composer-text"
        } ${line.hasBrackets ? "text-composer-error" : ""}`}
      >
        {line.isEmpty ? "(empty line)" : line.text}
      </span>
      {line.hasTiming && <span className="text-xs text-composer-accent-text shrink-0">synced</span>}
      {line.hasBrackets && <IconAlertTriangle className="w-4 h-4 text-composer-error shrink-0" />}
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

  const [rawText, setRawText] = useState("");
  const [importResult, setImportResult] = useState<{
    result: ParseResult;
    filename: string;
  } | null>(null);

  const parsed = useMemo(() => parseLyrics(rawText, lines), [rawText, lines]);
  const bracketCount = useMemo(() => parsed.filter((p) => p.hasBrackets).length, [parsed]);
  const nonEmptyCount = useMemo(() => parsed.filter((p) => !p.isEmpty).length, [parsed]);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      setRawText(text);

      const defaultAgent = agents[0]?.id ?? "v1";
      const lyricLines = textToLyricLines(text, defaultAgent);
      setLines(lyricLines);
      setImportResult(null);
    },
    [agents, setLines],
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

        setImportResult({ result, filename: file.name });
      }
    },
    [setLines, setMetadata],
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="flex flex-col flex-1 gap-4 p-4 overflow-hidden" onDrop={handleDrop} onDragOver={handleDragOver}>
      <div className="flex items-center justify-between select-none">
        <h2 className="text-lg font-medium">Lyrics Editor</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-composer-text-muted">
            {nonEmptyCount} line{nonEmptyCount !== 1 ? "s" : ""}
          </span>
          <Button onClick={handleImportClick}>
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
          <span className="mb-2 text-sm font-medium select-none text-composer-text-secondary">Preview</span>
          <div className="flex-1 overflow-y-auto border rounded-lg border-composer-border bg-composer-bg-dark">
            {parsed.length === 0 || (parsed.length === 1 && parsed[0].isEmpty) ? (
              <div className="flex items-center justify-center h-full text-sm text-composer-text-muted">
                Lyrics will appear here
              </div>
            ) : (
              <div className="py-2">
                {parsed.map((line) => (
                  <LinePreview key={line.lineNumber} line={line} />
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
