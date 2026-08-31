import { planTransliterationAlignment } from "@/domain/language/align";
import { splitTransliterationAtBoundaries, timingLexicalWordGroups } from "@/domain/language/transliteration-format";
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { Modal } from "@/ui/modal";
import { cn } from "@/utils/cn";
import { formatTime } from "@/utils/format-time";
import { IconArrowRight, IconCheck, IconSpace } from "@tabler/icons-react";
import { useMemo, useState } from "react";

type AlignmentField = "words" | "backgroundWords";

interface Grapheme {
  text: string;
  start: number;
  end: number;
}

const GRAPHEME_SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function graphemes(value: string): Grapheme[] {
  const segments = [...GRAPHEME_SEGMENTER.segment(value)];
  return segments.map((segment, index) => ({
    text: segment.segment,
    start: segment.index,
    end: segments[index + 1]?.index ?? value.length,
  }));
}

function groupReading(words: WordTiming[]): string {
  return words
    .map(
      (word, index) =>
        `${word.transliteration ?? ""}${index < words.length - 1 ? (word.transliterationJoinerAfter ?? "") : ""}`,
    )
    .join("");
}

function groupBoundaryPoints(words: WordTiming[]): number[] {
  let offset = 0;
  return words.slice(0, -1).map((word) => {
    offset += (word.transliteration ?? "").length + (word.transliterationJoinerAfter?.length ?? 0);
    return offset;
  });
}

const AlignmentPicker: React.FC<{
  value: string;
  points: number[];
  onToggle: (point: number) => void;
}> = ({ value, points, onToggle }) => {
  const selected = new Set(points);
  const units = graphemes(value);
  return (
    <div className="flex flex-wrap items-center justify-center gap-y-3 rounded-xl border border-composer-border bg-composer-input/70 px-4 py-6 text-xl tracking-wide">
      {units.map((unit, index) => {
        const whitespace = /^\s+$/.test(unit.text);
        if (whitespace) {
          if (index > 0 && /^\s+$/.test(units[index - 1].text)) return null;
          let endIndex = index;
          while (endIndex + 1 < units.length && /^\s+$/.test(units[endIndex + 1].text)) endIndex++;
          const end = units[endIndex].end;
          const run = value.slice(unit.start, end);
          return (
            <button
              key={`space-${unit.start}`}
              type="button"
              aria-label={`${run.length > 1 ? "Word" : "Pronunciation"} space boundary ${end}`}
              aria-pressed={selected.has(end)}
              onClick={() => onToggle(end)}
              className={cn(
                "mx-1 flex h-10 items-center justify-center rounded-lg border transition-colors",
                run.length > 1 ? "w-14" : "w-9",
                selected.has(end)
                  ? "border-composer-accent bg-composer-accent text-white"
                  : "border-composer-border bg-composer-button text-composer-text-muted hover:bg-composer-button-hover",
              )}
            >
              <IconSpace className="size-5" />
              {run.length > 1 && <span className="text-[9px] font-semibold uppercase tracking-wider">word</span>}
            </button>
          );
        }
        const boundary = unit.end;
        const atEnd = index === units.length - 1;
        return (
          <span key={`${unit.start}-${unit.text}`} className="flex items-center">
            <span>{unit.text}</span>
            {!atEnd && !/^\s+$/.test(units[index + 1].text) && (
              <button
                type="button"
                aria-label={`Alignment boundary ${boundary}`}
                aria-pressed={selected.has(boundary)}
                onClick={() => onToggle(boundary)}
                className={cn(
                  "mx-0.5 flex h-9 w-3 items-center justify-center rounded transition-colors",
                  selected.has(boundary) ? "bg-composer-accent" : "bg-composer-button hover:bg-composer-button-hover",
                )}
              >
                <span className={selected.has(boundary) ? "text-white" : "text-composer-text-tertiary"}>⋮</span>
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
};

interface TransliterationAlignmentModalProps {
  line: LyricLine;
  field: AlignmentField;
  onClose: () => void;
}

const TransliterationAlignmentModal: React.FC<TransliterationAlignmentModalProps> = ({ line, field, onClose }) => {
  const updateLine = useProjectStore((state) => state.updateLine);
  const track = line.transliteration;
  const canonicalText = field === "words" ? track?.text : track?.backgroundText;
  const sourceWords = line[field];
  const plannedWords = useMemo(
    () => (sourceWords && canonicalText ? planTransliterationAlignment(sourceWords, canonicalText).words : []),
    [canonicalText, sourceWords],
  );
  const groups = useMemo(() => timingLexicalWordGroups(plannedWords), [plannedWords]);
  const [groupIndex, setGroupIndex] = useState(() =>
    Math.max(
      0,
      groups.findIndex((group) => group.words.length > 1),
    ),
  );
  const [pointsByGroup, setPointsByGroup] = useState(() => groups.map((group) => groupBoundaryPoints(group.words)));
  const group = groups[groupIndex];
  const reading = group ? groupReading(group.words) : "";
  const points = pointsByGroup[groupIndex] ?? [];
  const required = Math.max(0, (group?.words.length ?? 1) - 1);
  const slices = splitTransliterationAtBoundaries(reading, points);
  const currentValid = points.length === required && slices.length === (group?.words.length ?? 0);
  const allValid =
    pointsByGroup.length === groups.length &&
    groups.every((candidate, index) => (pointsByGroup[index]?.length ?? 0) === candidate.words.length - 1);

  const save = () => {
    if (!track || !sourceWords || !allValid) return;
    const nextWords = plannedWords.slice();
    for (let index = 0; index < groups.length; index++) {
      const current = groups[index];
      const currentReading = groupReading(current.words);
      const currentSlices = splitTransliterationAtBoundaries(currentReading, pointsByGroup[index] ?? []);
      const outerJoiner = current.words[current.words.length - 1]?.transliterationJoinerAfter;
      for (let offset = 0; offset < current.words.length; offset++) {
        const wordIndex = current.startIndex + offset;
        const slice = currentSlices[offset];
        nextWords[wordIndex] = {
          ...nextWords[wordIndex],
          transliteration: slice?.text ?? "",
          ...(offset < current.words.length - 1
            ? { transliterationJoinerAfter: slice?.joinerAfter ?? "" }
            : outerJoiner !== undefined
              ? { transliterationJoinerAfter: outerJoiner }
              : {}),
        };
      }
    }
    updateLine(
      line.id,
      {
        [field]: nextWords,
        transliteration: {
          ...track,
          ...(field === "words"
            ? { alignmentStatus: "confirmed" as const }
            : { backgroundAlignmentStatus: "confirmed" as const }),
        },
      },
      { deriveText: false },
    );
    onClose();
  };

  if (!track || !sourceWords?.length || !canonicalText || !group) return null;

  return (
    <Modal isOpen onClose={onClose} title="Align transliteration" className="max-w-3xl" bodyClassName="p-0">
      <div className="border-b border-composer-border bg-composer-bg-elevated px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Original word</p>
            <p className="mt-1 text-xs text-composer-text-muted">
              Place one invisible boundary for each transition between timed parts.
            </p>
          </div>
          <select
            aria-label="Original word to align"
            value={groupIndex}
            onChange={(event) => setGroupIndex(Number(event.target.value))}
            className="h-9 max-w-xs rounded-md border border-composer-border bg-composer-input px-3 text-sm"
          >
            {groups.map((candidate, index) => (
              <option key={candidate.startIndex} value={index}>
                {index + 1}.{" "}
                {candidate.words
                  .map((word) => word.text)
                  .join("")
                  .trim()}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {group.words.map((word, index) => (
            <div
              key={`${word.begin}-${word.end}-${word.text}`}
              className="rounded-lg border border-composer-border bg-composer-input px-3 py-2"
            >
              <span className="mr-2 font-mono text-[10px] text-composer-text-muted">{index + 1}</span>
              <span className="text-sm font-medium">{word.text.trimEnd()}</span>
              <span className="ml-2 font-mono text-[10px] text-composer-text-muted">
                {formatTime(word.begin)}–{formatTime(word.end)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-5 p-5">
        <AlignmentPicker
          value={reading}
          points={points}
          onToggle={(point) =>
            setPointsByGroup((current) =>
              current.map((groupPoints, index) =>
                index === groupIndex
                  ? groupPoints.includes(point)
                    ? groupPoints.filter((candidate) => candidate !== point)
                    : [...groupPoints, point].toSorted((a, b) => a - b)
                  : groupPoints,
              ),
            )
          }
        />

        <div className="rounded-xl border border-composer-border bg-composer-bg-elevated p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-composer-text-muted">
            Timing map
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {group.words.map((word, index) => (
              <div key={`${word.begin}-${word.end}-${word.text}`} className="flex items-center gap-2">
                {index > 0 && <IconArrowRight className="size-3.5 text-composer-text-muted" />}
                <span className="rounded-md bg-composer-button px-2.5 py-1.5 text-sm">
                  <span className="mr-1.5 text-composer-text-muted">{word.text.trimEnd()}</span>
                  <span className="font-medium">{slices[index]?.text || "—"}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {!currentValid && (
          <p className="text-sm text-composer-error">
            Select {required} {required === 1 ? "boundary" : "boundaries"}; currently selected {points.length}.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-composer-border bg-composer-bg-dark px-5 py-4">
        <span className="text-xs text-composer-text-muted">
          Single gaps are pronunciation breaks; wider gaps are word breaks. Neither receives timing.
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" hasIcon disabled={!allValid} onClick={save}>
            <IconCheck className="size-4" />
            Save alignment
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export { TransliterationAlignmentModal };
export type { AlignmentField };
