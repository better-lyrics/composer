import { Tooltip } from "@/ui/tooltip";
import { cn } from "@/utils/cn";
import { isDashSeparator, isWhitespaceSeparator } from "@/utils/split-separators";
import { IconMinus, IconSpace } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

type DashMode = "separator" | "literal";
type SeparatorKind = "pronunciation" | "word" | "dash";

interface GraphemeUnit {
  text: string;
  start: number;
  end: number;
}

interface SeparatorRun {
  firstIndex: number;
  point: number;
  kind: SeparatorKind;
}

interface SplitPickerProps {
  value: string;
  points: readonly number[];
  onToggle: (point: number) => void;
  label: string;
  caption?: string;
  dashes?: DashMode;
}

// -- Constants ----------------------------------------------------------------

const GRAPHEME_SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const KIND_ORDER: readonly SeparatorKind[] = ["pronunciation", "word", "dash"];
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

// -- Helpers ------------------------------------------------------------------

function graphemeUnits(value: string): GraphemeUnit[] {
  const segments = [...GRAPHEME_SEGMENTER.segment(value)];
  return segments.map((segment, index) => ({
    text: segment.segment,
    start: segment.index,
    end: segments[index + 1]?.index ?? value.length,
  }));
}

function isSeparatorUnit(text: string, dashes: DashMode): boolean {
  return isWhitespaceSeparator(text) || (dashes === "separator" && isDashSeparator(text));
}

function kindOfRun(run: string): SeparatorKind {
  const spaces = [...run].filter(isWhitespaceSeparator).length;
  if (spaces === 0) return "dash";
  return spaces > 1 ? "word" : "pronunciation";
}

function separatorRuns(value: string, units: GraphemeUnit[], dashes: DashMode): SeparatorRun[] {
  const runs: SeparatorRun[] = [];
  let index = 0;
  while (index < units.length) {
    if (!isSeparatorUnit(units[index].text, dashes)) {
      index++;
      continue;
    }
    let last = index;
    while (last + 1 < units.length && isSeparatorUnit(units[last + 1].text, dashes)) last++;
    if (index > 0 && last < units.length - 1) {
      const point = units[last].end;
      runs.push({ firstIndex: index, point, kind: kindOfRun(value.slice(units[index].start, point)) });
    }
    index = last + 1;
  }
  return runs;
}

function separatorKinds(values: readonly string[], dashes: DashMode = "separator"): SeparatorKind[] {
  const present = new Set(
    values.flatMap((value) => separatorRuns(value, graphemeUnits(value), dashes)).map((run) => run.kind),
  );
  return KIND_ORDER.filter((kind) => present.has(kind));
}

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
          <span className="inline-flex items-center gap-1.5 cursor-help">
            <span
              className={cn(
                "h-5 flex items-center justify-center rounded bg-composer-button",
                kind === "word" ? "w-7" : "w-5",
              )}
            >
              <SeparatorGlyph kind={kind} className="size-3.5 text-composer-text-tertiary" />
            </span>
            {LEGEND[kind].label}
          </span>
        </Tooltip>
      ))}
      <span className="text-composer-text-faint">{LEGEND_SUMMARY[kinds.length]}</span>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { SplitPicker, SplitPickerLegend, separatorKinds };
export type { DashMode, SeparatorKind };
