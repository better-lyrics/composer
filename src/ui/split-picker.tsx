import { Tooltip } from "@/ui/tooltip";
import { cn } from "@/utils/cn";
import {
  type DashMode,
  type SeparatorKind,
  graphemeUnits,
  isSeparatorUnit,
  separatorRuns,
} from "@/utils/split-separators";
import { IconMinus, IconSpace } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface SplitPickerProps {
  value: string;
  points: readonly number[];
  onToggle: (point: number) => void;
  label: string;
  caption?: string;
  dashes?: DashMode;
}

// -- Constants ----------------------------------------------------------------

const KIND_ARIA: Record<SeparatorKind, string> = {
  pronunciation: "pronunciation break",
  word: "word break",
  dash: "dash",
};
const LEGEND: Record<SeparatorKind, { label: string; explanation: string }> = {
  pronunciation: { label: "Pronunciation break", explanation: "One space between syllables." },
  word: { label: "Word break", explanation: "Two spaces between words." },
  dash: { label: "Dash", explanation: "Kept as text, never timed." },
};
const LEGEND_SUMMARY = ["", "Not timed.", "Neither is timed.", "None are timed."];

// -- Components ---------------------------------------------------------------

const SeparatorGlyph: React.FC<{ kind: SeparatorKind; className: string }> = ({ kind, className }) => {
  if (kind === "dash") return <IconMinus aria-hidden="true" className={className} />;
  if (kind === "word")
    return (
      <span className="flex">
        <IconSpace aria-hidden="true" className={className} />
        <IconSpace aria-hidden="true" className={cn(className, "-ml-1.5")} />
      </span>
    );
  return <IconSpace aria-hidden="true" className={className} />;
};

const SplitPicker: React.FC<SplitPickerProps> = ({ value, points, onToggle, label, caption, dashes = "separator" }) => {
  const selected = new Set(points);
  const units = graphemeUnits(value);
  const runByFirstIndex = new Map(separatorRuns(value, units, dashes).map((run) => [run.firstIndex, run]));

  return (
    <div>
      {caption && <p className="mb-2 text-xs text-center text-composer-text-muted select-none">{caption}</p>}
      <div className="flex flex-wrap items-center justify-center gap-0.5 py-4 text-2xl select-none">
        {units.map((unit, index) => {
          if (isSeparatorUnit(unit.text, dashes)) {
            const run = runByFirstIndex.get(index);
            if (!run) return null;
            const active = selected.has(run.point);
            return (
              <button
                key={`separator-${unit.start}`}
                type="button"
                aria-label={`${label} ${KIND_ARIA[run.kind]} ${run.point}`}
                aria-pressed={active}
                onClick={() => onToggle(run.point)}
                className={cn(
                  "h-8 mx-1 flex items-center justify-center rounded-md transition-colors cursor-pointer",
                  run.kind === "word" ? "w-12" : "w-8",
                  active ? "bg-composer-accent" : "bg-composer-button hover:bg-composer-button-hover",
                )}
              >
                <SeparatorGlyph
                  kind={run.kind}
                  className={cn("size-5", active ? "text-composer-on-accent" : "text-composer-text-tertiary")}
                />
              </button>
            );
          }
          const next = units[index + 1];
          const showBoundary = next !== undefined && !isSeparatorUnit(next.text, dashes);
          const active = selected.has(unit.end);
          return (
            <span key={`${unit.start}-${unit.text}`} className="flex items-center">
              <span className="text-composer-text">{unit.text}</span>
              {showBoundary && (
                <button
                  type="button"
                  aria-label={`${label} split point ${unit.end}`}
                  aria-pressed={active}
                  onClick={() => onToggle(unit.end)}
                  className={cn(
                    "group w-4 h-8 mx-0.5 flex items-center justify-center rounded transition-colors cursor-pointer",
                    active ? "bg-composer-accent" : "bg-composer-button hover:bg-composer-button-hover",
                  )}
                >
                  <span
                    className={cn(
                      "text-sm font-bold",
                      active ? "text-composer-on-accent" : "text-composer-text-tertiary group-hover:text-composer-text",
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
};

const SplitPickerLegend: React.FC<{ kinds: readonly SeparatorKind[] }> = ({ kinds }) => {
  if (kinds.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-composer-text-muted select-none">
      {kinds.map((kind) => (
        <Tooltip key={kind} content={LEGEND[kind].explanation}>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 cursor-help rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-composer-accent"
          >
            <span
              className={cn(
                "h-5 flex items-center justify-center rounded bg-composer-button",
                kind === "word" ? "w-7" : "w-5",
              )}
            >
              <SeparatorGlyph kind={kind} className="size-3.5 text-composer-text-tertiary" />
            </span>
            {LEGEND[kind].label}
          </button>
        </Tooltip>
      ))}
      <span className="text-composer-text-faint">{LEGEND_SUMMARY[kinds.length]}</span>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { SplitPicker, SplitPickerLegend };
