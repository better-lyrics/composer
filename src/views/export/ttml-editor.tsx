import { Button } from "@/ui/button";
import { Scroll } from "@/ui/scroll";
import { TtmlDiffViewer } from "@/views/export/ttml-diff-viewer";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import { useState } from "react";

// -- Interfaces ---------------------------------------------------------------

interface TtmlEditorProps {
  value: string;
  generatedTtml: string;
  hasEdits: boolean;
  hasConflict: boolean;
  onChange: (value: string) => void;
  onRegenerate: () => void;
}

// -- Components ---------------------------------------------------------------

const TtmlEditor: React.FC<TtmlEditorProps> = ({
  value,
  generatedTtml,
  hasEdits,
  hasConflict,
  onChange,
  onRegenerate,
}) => {
  const [showDiff, setShowDiff] = useState(false);
  const canDiff = hasEdits && value !== generatedTtml;
  const viewingDiff = showDiff && canDiff;

  return (
    <div className="flex flex-col flex-1 min-h-0 p-6 gap-3">
      {hasConflict && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-composer-warning/20 bg-composer-warning/10 px-2.5 py-2 text-xs text-composer-warning"
        >
          <span className="flex items-center gap-2 select-text cursor-text">
            <IconAlertTriangle size={14} className="shrink-0" />
            The lyrics changed while you were editing. Your edits and the new version differ.
          </span>
          <Button hasIcon size="sm" onClick={onRegenerate}>
            <IconRefresh className="size-4" />
            Regenerate
          </Button>
        </div>
      )}
      {canDiff && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setShowDiff((shown) => !shown)}>
            {viewingDiff ? "Hide diff" : "View diff"}
          </Button>
        </div>
      )}
      {viewingDiff ? (
        <Scroll className="flex-1 rounded-lg bg-composer-bg-elevated p-2">
          <TtmlDiffViewer oldTtml={generatedTtml} newTtml={value} />
        </Scroll>
      ) : (
        <textarea
          value={value}
          aria-label="Edit TTML content"
          onChange={(event) => onChange(event.target.value)}
          className="w-full flex-1 p-4 rounded-lg font-mono text-xs bg-composer-bg-elevated text-composer-text resize-none focus:outline-none focus:ring-1 focus:ring-composer-accent"
          spellCheck={false}
        />
      )}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { TtmlEditor };
