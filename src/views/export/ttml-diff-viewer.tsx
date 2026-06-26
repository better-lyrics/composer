import { cn } from "@/utils/cn";
import { diffLines } from "diff";
import { useMemo } from "react";

// -- Interfaces ---------------------------------------------------------------

interface TtmlDiffViewerProps {
  oldTtml: string;
  newTtml: string;
}

type DiffKind = "add" | "remove" | "context";

interface DiffLine {
  text: string;
  kind: DiffKind;
}

// -- Constants ----------------------------------------------------------------

const LINE_CLASS: Record<DiffKind, string> = {
  add: "bg-green-500/10 text-green-300",
  remove: "bg-red-500/10 text-red-300",
  context: "text-composer-text-muted",
};

const PREFIX: Record<DiffKind, string> = {
  add: "+",
  remove: "-",
  context: " ",
};

// -- Components ---------------------------------------------------------------

const TtmlDiffViewer: React.FC<TtmlDiffViewerProps> = ({ oldTtml, newTtml }) => {
  const lines = useMemo<DiffLine[]>(() => {
    const out: DiffLine[] = [];
    for (const change of diffLines(oldTtml, newTtml)) {
      const kind: DiffKind = change.added ? "add" : change.removed ? "remove" : "context";
      const parts = change.value.split("\n");
      if (parts.length > 1 && parts[parts.length - 1] === "") parts.pop();
      for (const text of parts) out.push({ text, kind });
    }
    return out;
  }, [oldTtml, newTtml]);

  return (
    <pre className="font-mono text-xs leading-5 select-text cursor-text">
      {lines.map((line, index) => (
        <div key={`${index}-${line.kind}`} className={cn("px-4 whitespace-pre-wrap break-all", LINE_CLASS[line.kind])}>
          <span className="select-none opacity-50 mr-2">{PREFIX[line.kind]}</span>
          {line.text}
        </div>
      ))}
    </pre>
  );
};

// -- Exports ------------------------------------------------------------------

export { TtmlDiffViewer };
