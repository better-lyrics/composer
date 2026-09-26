import { planTransliterationAlignment } from "@/domain/language/align";
import { splitTransliterationAtBoundaries, timingLexicalWordGroups } from "@/domain/language/transliteration-format";
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { Modal } from "@/ui/modal";
import { Select } from "@/ui/select";
import { SplitPicker, SplitPickerLegend, separatorKinds } from "@/ui/split-picker";
import { formatTime } from "@/utils/format-time";
import { TransliterationTimingMap } from "@/views/languages/transliteration-timing-map";
import { IconCheck } from "@tabler/icons-react";
import { useMemo, useState } from "react";

// -- Types ----------------------------------------------------------------------

type AlignmentField = "words" | "backgroundWords";

interface TransliterationAlignmentModalProps {
  line: LyricLine;
  field: AlignmentField;
  onClose: () => void;
}

// -- Helpers ----------------------------------------------------------------------

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

// -- Component ----------------------------------------------------------------

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
  const slices = splitTransliterationAtBoundaries(reading, points, { preserveEdgeDashes: true });
  const currentValid = points.length === required && slices.length === (group?.words.length ?? 0);
  const allValid =
    pointsByGroup.length === groups.length &&
    groups.every((candidate, index) => (pointsByGroup[index]?.length ?? 0) === candidate.words.length - 1);

  const wordOptions = useMemo(
    () =>
      groups.map((candidate, index) => ({
        value: String(index),
        label: `${index + 1}. ${candidate.words
          .map((word) => word.text)
          .join("")
          .trim()}`,
      })),
    [groups],
  );
  const togglePoint = (point: number) =>
    setPointsByGroup((current) =>
      current.map((groupPoints, index) =>
        index === groupIndex
          ? groupPoints.includes(point)
            ? groupPoints.filter((candidate) => candidate !== point)
            : [...groupPoints, point].toSorted((a, b) => a - b)
          : groupPoints,
      ),
    );

  const save = () => {
    if (!track || !sourceWords || !allValid) return;
    const nextWords = plannedWords.slice();
    for (let index = 0; index < groups.length; index++) {
      const current = groups[index];
      const currentReading = groupReading(current.words);
      const currentSlices = splitTransliterationAtBoundaries(currentReading, pointsByGroup[index] ?? [], {
        preserveEdgeDashes: true,
      });
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
    <Modal
      isOpen
      onClose={onClose}
      title="Align timing"
      className="max-h-[calc(100vh-2rem)] max-w-3xl flex flex-col"
      bodyClassName="p-0 min-h-0 flex flex-1 flex-col"
    >
      <div data-transliteration-alignment-scroll-region className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="flex flex-col gap-5 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-composer-text-secondary text-pretty select-none">
              Click between letters where each timed syllable starts.
            </p>
            <Select
              aria-label="Original word to align"
              value={String(groupIndex)}
              onChange={(next) => setGroupIndex(Number(next))}
              options={wordOptions}
              className="h-8 shrink-0"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {group.words.map((word, index) => (
              <span
                key={`${word.begin}-${word.end}-${index}`}
                className="inline-flex h-7 items-baseline gap-2 rounded-lg bg-composer-button px-2.5 text-sm leading-7"
              >
                <span className="select-none">{word.text.trimEnd()}</span>
                <span className="font-mono text-[11px] text-composer-text-muted tabular-nums select-text">
                  {formatTime(word.begin)} - {formatTime(word.end)}
                </span>
              </span>
            ))}
          </div>
          <SplitPicker
            value={reading}
            points={points}
            onToggle={togglePoint}
            label="Transliteration"
            dashes="literal"
          />
          <TransliterationTimingMap
            words={group.words}
            slices={slices}
            trailingJoiner={
              group.startIndex + group.words.length < plannedWords.length
                ? group.words.at(-1)?.transliterationJoinerAfter
                : undefined
            }
          />
          {!currentValid && (
            <p className="text-sm text-center text-composer-error-text select-text">
              Pick {required} split {required === 1 ? "point" : "points"} ({points.length} so far).
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-composer-border px-5 py-4">
        <SplitPickerLegend kinds={separatorKinds([reading], "literal")} />
        <div className="ml-auto flex gap-2 select-none">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" hasIcon disabled={!allValid} onClick={save}>
            <IconCheck className="size-4" />
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// -- Exports ------------------------------------------------------------------

export { TransliterationAlignmentModal };
export type { AlignmentField };
