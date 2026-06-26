import { cn } from "@/utils/cn";
import { diffLines, diffWordsWithSpace } from "diff";
import { useMemo } from "react";

// -- Interfaces ---------------------------------------------------------------

interface TtmlDiffViewerProps {
  oldTtml: string;
  newTtml: string;
}

type DiffKind = "add" | "remove" | "context";

interface DiffSegment {
  text: string;
  emphasis: boolean;
}

interface DiffRow {
  kind: DiffKind;
  segments: DiffSegment[];
}

// -- Constants ----------------------------------------------------------------

const ROW_CLASS: Record<DiffKind, string> = {
  add: "bg-green-500/10 text-green-300",
  remove: "bg-red-500/10 text-red-300",
  context: "text-composer-text-muted",
};

const MARK_CLASS: Record<DiffKind, string> = {
  add: "bg-green-500/30 text-green-200 rounded-sm",
  remove: "bg-red-500/30 text-red-200 rounded-sm",
  context: "",
};

const PREFIX: Record<DiffKind, string> = { add: "+", remove: "-", context: " " };

// -- Helpers ------------------------------------------------------------------

function toLines(value: string): string[] {
  const parts = value.split("\n");
  if (parts.length > 1 && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

function buildRows(oldTtml: string, newTtml: string): DiffRow[] {
  const rows: DiffRow[] = [];
  const changes = diffLines(oldTtml, newTtml);
  for (let i = 0; i < changes.length; i += 1) {
    const change = changes[i];
    const next = changes[i + 1];
    const isSingleLineReplace =
      change.removed && next?.added && toLines(change.value).length === 1 && toLines(next.value).length === 1;
    if (isSingleLineReplace) {
      const words = diffWordsWithSpace(toLines(change.value)[0] ?? "", toLines(next.value)[0] ?? "");
      rows.push({
        kind: "remove",
        segments: words
          .filter((word) => !word.added)
          .map((word) => ({ text: word.value, emphasis: Boolean(word.removed) })),
      });
      rows.push({
        kind: "add",
        segments: words
          .filter((word) => !word.removed)
          .map((word) => ({ text: word.value, emphasis: Boolean(word.added) })),
      });
      i += 1;
      continue;
    }
    const kind: DiffKind = change.added ? "add" : change.removed ? "remove" : "context";
    for (const line of toLines(change.value)) {
      rows.push({ kind, segments: [{ text: line, emphasis: false }] });
    }
  }
  return rows;
}

// -- Components ---------------------------------------------------------------

const TtmlDiffViewer: React.FC<TtmlDiffViewerProps> = ({ oldTtml, newTtml }) => {
  const rows = useMemo(() => buildRows(oldTtml, newTtml), [oldTtml, newTtml]);

  return (
    <pre className="font-mono text-xs leading-5 select-text cursor-text">
      {rows.map((row, rowIndex) => (
        <div key={`${rowIndex}-${row.kind}`} className={cn("px-4 whitespace-pre-wrap break-all", ROW_CLASS[row.kind])}>
          <span className="select-none opacity-50 mr-2">{PREFIX[row.kind]}</span>
          {row.segments.map((segment, segmentIndex) =>
            segment.emphasis ? (
              <mark key={`${segmentIndex}-${row.kind}`} className={MARK_CLASS[row.kind]}>
                {segment.text}
              </mark>
            ) : (
              <span key={`${segmentIndex}-${row.kind}`}>{segment.text}</span>
            ),
          )}
        </div>
      ))}
    </pre>
  );
};

// -- Exports ------------------------------------------------------------------

export { TtmlDiffViewer };
