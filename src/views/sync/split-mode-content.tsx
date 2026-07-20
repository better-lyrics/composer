import { Button } from "@/ui/button";
import { cn } from "@/utils/cn";
import { IconMinus, IconSpace } from "@tabler/icons-react";
import { useMemo } from "react";

// -- Interfaces ---------------------------------------------------------------

interface SplitModeContentProps {
  text: string;
  splitPoints: number[];
  onToggleSplit: (index: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
  applyToAll: boolean;
  onApplyToAllChange: (next: boolean) => void;
  caseInsensitive: boolean;
  onCaseInsensitiveChange: (next: boolean) => void;
  identicalCount: number;
  sourceText: string;
  showApplyControls: boolean;
  secondaryText?: string;
  secondarySplitPoints?: number[];
  onToggleSecondarySplit?: (index: number) => void;
}

const isWhitespace = (char: string) => /\s/.test(char);
const isDash = (char: string) => /[-\u2010-\u2015]/.test(char);
const isUntimedSeparator = (char: string) => isWhitespace(char) || isDash(char);

// -- Components ---------------------------------------------------------------

const SplitModeContent: React.FC<SplitModeContentProps> = ({
  text,
  splitPoints,
  onToggleSplit,
  onConfirm,
  onCancel,
  applyToAll,
  onApplyToAllChange,
  caseInsensitive,
  onCaseInsensitiveChange,
  identicalCount,
  sourceText,
  showApplyControls,
  secondaryText,
  secondarySplitPoints = [],
  onToggleSecondarySplit,
}) => {
  const previewParts = useMemo(() => {
    if (splitPoints.length === 0) return [text];
    const sorted = splitPoints.toSorted((a, b) => a - b);
    const result: string[] = [];
    let lastIdx = 0;
    for (const point of sorted) {
      if (point > lastIdx && point < text.length) {
        result.push(text.slice(lastIdx, point));
        lastIdx = point;
      }
    }
    result.push(text.slice(lastIdx));
    return result;
  }, [text, splitPoints]);

  const confirmLabel = applyToAll && identicalCount > 0 ? "Split all" : "Split Word";
  const splitPicker = (value: string, points: number[], onToggle: (index: number) => void, label?: string) => (
    <div>
      {label && <p className="mb-2 text-xs text-center text-composer-text-muted">{label}</p>}
      <div className="flex flex-wrap items-center justify-center gap-0.5 py-4 text-2xl tracking-wide">
        {value.split("").map((char, idx) => {
          if (isUntimedSeparator(char)) {
            if (idx > 0 && isUntimedSeparator(value[idx - 1])) return null;
            let separatorEnd = idx + 1;
            while (separatorEnd < value.length && isUntimedSeparator(value[separatorEnd])) separatorEnd++;
            if (idx === 0 || separatorEnd === value.length) return null;
            const active = points.includes(separatorEnd);
            const space = isWhitespace(char);
            return (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: separator position is stable
                key={idx}
                type="button"
                aria-label={`${label ?? "Text"} ${space ? "space" : "dash"} boundary ${separatorEnd}`}
                title={`${space ? "Space" : "Dash"} is untimed — click once to split here`}
                onClick={() => onToggle(separatorEnd)}
                className={cn(
                  "w-8 h-8 flex items-center group justify-center mx-1 rounded-md transition-colors cursor-pointer",
                  active ? "bg-composer-accent" : "bg-composer-button hover:bg-composer-button-hover",
                )}
              >
                {space ? (
                  <IconSpace className={cn("size-5", active ? "text-white" : "text-composer-text-tertiary")} />
                ) : (
                  <IconMinus className={cn("size-5", active ? "text-white" : "text-composer-text-tertiary")} />
                )}
              </button>
            );
          }
          const showBoundary = idx < value.length - 1 && !isUntimedSeparator(value[idx + 1]);
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: character order is fixed
            <span key={idx} className="flex items-center">
              <span className="text-composer-text">{char}</span>
              {showBoundary && (
                <button
                  type="button"
                  aria-label={`${label ?? "Text"} split point ${idx + 1}`}
                  onClick={() => onToggle(idx + 1)}
                  className={cn(
                    "w-4 h-8 flex items-center group justify-center mx-0.5 rounded transition-colors cursor-pointer",
                    points.includes(idx + 1)
                      ? "bg-composer-accent"
                      : "bg-composer-button hover:bg-composer-button-hover",
                  )}
                >
                  <span
                    className={cn(
                      "text-sm font-bold",
                      points.includes(idx + 1)
                        ? "text-white"
                        : "text-composer-text-tertiary group-hover:text-composer-text",
                    )}
                  >
                    ⋮
                  </span>
                </button>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
  const pairedValid = !secondaryText || splitPoints.length === secondarySplitPoints.length;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-composer-text-secondary">Click between letters to mark split points</p>

      {splitPicker(text, splitPoints, onToggleSplit, secondaryText ? "Original" : undefined)}
      {secondaryText &&
        onToggleSecondarySplit &&
        splitPicker(secondaryText, secondarySplitPoints, onToggleSecondarySplit, "Transliteration")}
      {!pairedValid && (
        <p className="text-sm text-center text-composer-error">
          Original and transliteration must have the same number of segments.
        </p>
      )}

      {splitPoints.length > 0 && (
        <div className="flex items-center justify-center gap-2 text-sm text-composer-text-muted">
          <span>Preview:</span>
          <span className="font-medium text-composer-text">{previewParts.join(" · ")}</span>
        </div>
      )}

      {showApplyControls && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
            {/* react-doctor-disable-next-line react-doctor/control-has-associated-label */}
            <input type="checkbox" checked={applyToAll} onChange={(e) => onApplyToAllChange(e.target.checked)} />
            <span>Apply to all identical words</span>
          </label>
          <label
            className={cn(
              "flex items-center gap-2 select-none text-sm",
              applyToAll ? "cursor-pointer" : "opacity-50 cursor-not-allowed",
            )}
          >
            {/* react-doctor-disable-next-line react-doctor/control-has-associated-label */}
            <input
              type="checkbox"
              checked={applyToAll && caseInsensitive}
              onChange={(e) => onCaseInsensitiveChange(e.target.checked)}
              disabled={!applyToAll}
            />
            <span>Case-insensitive matching</span>
          </label>
          {applyToAll && identicalCount > 0 && (
            <p className="text-sm text-composer-text-secondary">
              This will also split {identicalCount} other "{sourceText}"{identicalCount === 1 ? "" : "s"}
            </p>
          )}
          {applyToAll && identicalCount === 0 && (
            <p className="text-sm text-composer-text-muted">No other matching words</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={onConfirm} disabled={splitPoints.length === 0 || !pairedValid}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { SplitModeContent };
