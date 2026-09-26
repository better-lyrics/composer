import { Button } from "@/ui/button";
import { SplitPicker, SplitPickerLegend } from "@/ui/split-picker";
import { separatorKinds } from "@/utils/split-separators";
import { cn } from "@/utils/cn";
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

// -- Constants ----------------------------------------------------------------

const EMPTY_SPLIT_POINTS: number[] = [];

// -- Components ---------------------------------------------------------------

const SplitPreview: React.FC<Pick<SplitModeContentProps, "text" | "splitPoints">> = ({ text, splitPoints }) => {
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

  if (splitPoints.length === 0) return null;
  return (
    <div className="flex items-center justify-center gap-2 text-sm text-composer-text-muted">
      <span>Preview:</span>
      <span className="font-medium text-composer-text">{previewParts.join(" · ")}</span>
    </div>
  );
};

const SplitApplyControls: React.FC<
  Pick<
    SplitModeContentProps,
    | "applyToAll"
    | "onApplyToAllChange"
    | "caseInsensitive"
    | "onCaseInsensitiveChange"
    | "identicalCount"
    | "sourceText"
  >
> = ({ applyToAll, onApplyToAllChange, caseInsensitive, onCaseInsensitiveChange, identicalCount, sourceText }) => (
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
    {applyToAll && identicalCount === 0 && <p className="text-sm text-composer-text-muted">No other matching words</p>}
  </div>
);

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
  secondarySplitPoints = EMPTY_SPLIT_POINTS,
  onToggleSecondarySplit,
}) => {
  const confirmLabel = applyToAll && identicalCount > 0 ? "Split all" : "Split Word";
  const pairedValid = !secondaryText || splitPoints.length === secondarySplitPoints.length;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-composer-text-secondary">Click between letters to mark split points</p>

      <SplitPicker
        value={text}
        points={splitPoints}
        onToggle={onToggleSplit}
        label={secondaryText ? "Original" : "Text"}
        caption={secondaryText ? "Original" : undefined}
      />
      {secondaryText && onToggleSecondarySplit && (
        <SplitPicker
          value={secondaryText}
          points={secondarySplitPoints}
          onToggle={onToggleSecondarySplit}
          label="Transliteration"
          caption="Transliteration"
        />
      )}
      <SplitPickerLegend kinds={separatorKinds([text, secondaryText ?? ""])} />
      {!pairedValid && (
        <p className="text-sm text-center text-composer-error-text select-text">
          Both rows need the same number of parts.
        </p>
      )}

      <SplitPreview text={text} splitPoints={splitPoints} />

      {showApplyControls && (
        <SplitApplyControls
          applyToAll={applyToAll}
          onApplyToAllChange={onApplyToAllChange}
          caseInsensitive={caseInsensitive}
          onCaseInsensitiveChange={onCaseInsensitiveChange}
          identicalCount={identicalCount}
          sourceText={sourceText}
        />
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
