import { Button } from "@/ui/button";
import { Scroll } from "@/ui/scroll";
import { TtmlDiffViewer } from "@/views/export/ttml-diff-viewer";
import { useState } from "react";

// -- Interfaces ---------------------------------------------------------------

interface TtmlEditorProps {
  value: string;
  generatedTtml: string;
  hasEdits: boolean;
  onChange: (value: string) => void;
}

// -- Components ---------------------------------------------------------------

const TtmlEditor: React.FC<TtmlEditorProps> = ({ value, generatedTtml, hasEdits, onChange }) => {
  const [showDiff, setShowDiff] = useState(false);
  const canDiff = hasEdits && value !== generatedTtml;
  const viewingDiff = showDiff && canDiff;

  return (
    <div className="flex flex-col flex-1 min-h-0 p-6 gap-3">
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
