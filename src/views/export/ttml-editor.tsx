import { Button } from "@/ui/button";
import { FieldError } from "@/ui/field-error";
import { LyricsCodeEditor } from "@/ui/lyrics-code/lyrics-code-editor";
import { Scroll } from "@/ui/scroll";
import { validateTtml } from "@/utils/lyrics-parsers/validate-ttml";
import { TtmlDiffViewer } from "@/views/export/ttml-diff-viewer";
import { type ReactNode, useDeferredValue, useId, useMemo, useState } from "react";

// -- Interfaces ---------------------------------------------------------------

interface TtmlEditorProps {
  value: string;
  generatedTtml: string;
  onChange: (value: string) => void;
  head?: ReactNode;
}

// -- Components ---------------------------------------------------------------

const TtmlEditor: React.FC<TtmlEditorProps> = ({ value, generatedTtml, onChange, head }) => {
  const errorId = useId();
  const [showDiff, setShowDiff] = useState(false);
  const canDiff = value !== generatedTtml;
  const viewingDiff = showDiff && canDiff;
  const settledValue = useDeferredValue(value);
  const validation = useMemo(
    () => (settledValue !== generatedTtml ? validateTtml(settledValue) : null),
    [settledValue, generatedTtml],
  );
  const xmlError = validation?.ok === false ? `XML error: ${validation.message}` : null;

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3.5">
      {(head || canDiff) && (
        <div className="flex h-7 shrink-0 items-center justify-between gap-3">
          {head}
          {canDiff && (
            <Button variant="ghost" size="sm" onClick={() => setShowDiff((shown) => !shown)} className="ml-auto">
              {viewingDiff ? "Hide diff" : "View diff"}
            </Button>
          )}
        </div>
      )}
      {viewingDiff ? (
        <Scroll className="flex-1 lyrics-code-surface p-2">
          <TtmlDiffViewer oldTtml={generatedTtml} newTtml={value} />
        </Scroll>
      ) : (
        <LyricsCodeEditor
          value={value}
          format="ttml"
          aria-label="Edit TTML content"
          aria-invalid={xmlError !== null}
          aria-describedby={xmlError === null ? undefined : errorId}
          onChange={(event) => onChange(event.target.value)}
          frameClassName="flex-1 min-h-0 [border-color:var(--edge)] focus-within:[border-color:var(--lit-ring)]"
          className="px-4 py-3.5 font-mono text-xs leading-5 focus:outline-none"
          spellCheck={false}
        />
      )}
      <FieldError id={errorId} message={xmlError} />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { TtmlEditor };
