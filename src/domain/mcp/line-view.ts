import {
  mappedTransliteration,
  planTransliterationAlignment,
  timedPrefixText,
  withAlignedTransliteration,
} from "@/domain/language/align";
import type { TransliterationAlignmentStatus } from "@/domain/language/model";
import { getLanguageReviewTracks } from "@/domain/language/review";
import type { LyricLine } from "@/domain/line/model";
import { isLineSynced, isWordSynced } from "@/domain/line/predicates";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

interface SyllableView {
  text: string;
  begin: number;
  end: number;
  transliteration?: string;
}

interface LineView {
  lineId: string;
  number: number;
  text: string;
  backgroundText?: string;
  timing: "word" | "line" | "none";
  syllables?: SyllableView[];
  backgroundSyllables?: SyllableView[];
  transliteration?: {
    language: string;
    text: string;
    backgroundText?: string;
    alignment?: TransliterationAlignmentStatus;
    backgroundAlignment?: TransliterationAlignmentStatus;
    /** "estimated": Composer computes this split on the fly; nothing is saved on the syllables yet. */
    split?: "saved" | "estimated";
    backgroundSplit?: "saved" | "estimated";
  };
  translations?: Record<string, { text: string; backgroundText?: string }>;
  issues: string[];
}

// -- Helpers ------------------------------------------------------------------

function seconds(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function syllables(words: WordTiming[] | undefined): SyllableView[] | undefined {
  return words?.map((word) => ({
    text: word.text,
    begin: seconds(word.begin),
    end: seconds(word.end),
    ...(word.transliteration !== undefined ? { transliteration: word.transliteration } : {}),
  }));
}

// -- Functions ----------------------------------------------------------------

/**
 * Auto-align and lyric edits can leave syllables with no stored reading. Composer
 * then estimates the split wherever it shows or exports the line, so report that
 * estimate's status rather than treating the syllables as empty.
 */
function estimatedStatus(
  words: WordTiming[] | undefined,
  text: string,
  reading: string | undefined,
): TransliterationAlignmentStatus | null {
  if (!reading?.trim() || !words?.length || mappedTransliteration(words) !== null) return null;
  return planTransliterationAlignment(words, timedPrefixText(text, words, reading)).status;
}

interface PartSplit {
  /** The estimate's status for an estimated split; the saved status, which auto-align leaves stale, otherwise. */
  status?: TransliterationAlignmentStatus;
  estimated: boolean;
}

function partSplits(line: LyricLine): { main: PartSplit; background: PartSplit } {
  const track = line.transliteration;
  const main = estimatedStatus(line.words, line.text, track?.text);
  const background = estimatedStatus(line.backgroundWords, line.backgroundText ?? "", track?.backgroundText);
  return {
    main: { status: main ?? track?.alignmentStatus, estimated: main !== null },
    background: { status: background ?? track?.backgroundAlignmentStatus, estimated: background !== null },
  };
}

/** The same warnings the Languages tab shows, as stable codes an agent can act on. */
function lineIssues(line: LyricLine): string[] {
  const issues = getLanguageReviewTracks(line).flatMap((track) =>
    track.kind === "translation"
      ? [`translation-source-changed:${track.language}`]
      : track.reasons.map((reason) =>
          reason === "alignment" ? "transliteration-alignment-needs-review" : "transliteration-source-changed",
        ),
  );
  const parts = Object.values(partSplits(line));
  if (parts.some((part) => part.status === "unresolved")) issues.push("transliteration-does-not-fit-syllables");
  const guessed = parts.some((part) => part.estimated && part.status === "needs-review");
  if (guessed && !issues.includes("transliteration-alignment-needs-review")) {
    issues.push("transliteration-alignment-needs-review");
  }
  return issues;
}

function lineView(line: LyricLine, index: number): LineView {
  const track = line.transliteration;
  const aligned = withAlignedTransliteration(line);
  const { main, background } = partSplits(line);
  const translations = Object.entries(line.translations ?? {});
  return {
    lineId: line.id,
    number: index + 1,
    text: line.text,
    ...(line.backgroundText ? { backgroundText: line.backgroundText } : {}),
    timing: isWordSynced(line) ? "word" : isLineSynced(line) ? "line" : "none",
    ...(aligned.words?.length ? { syllables: syllables(aligned.words) } : {}),
    ...(aligned.backgroundWords?.length ? { backgroundSyllables: syllables(aligned.backgroundWords) } : {}),
    ...(track
      ? {
          transliteration: {
            language: track.language,
            text: track.text,
            ...(track.backgroundText ? { backgroundText: track.backgroundText } : {}),
            ...(main.status ? { alignment: main.status } : {}),
            ...(background.status ? { backgroundAlignment: background.status } : {}),
            ...(track.text.trim() && line.words?.length ? { split: main.estimated ? "estimated" : "saved" } : {}),
            ...(track.backgroundText?.trim() && line.backgroundWords?.length
              ? { backgroundSplit: background.estimated ? "estimated" : "saved" }
              : {}),
          },
        }
      : {}),
    ...(translations.length > 0
      ? {
          translations: Object.fromEntries(
            translations.map(([language, translation]) => [
              language,
              {
                text: translation.text,
                ...(translation.backgroundText ? { backgroundText: translation.backgroundText } : {}),
              },
            ]),
          ),
        }
      : {}),
    issues: lineIssues(line),
  };
}

// -- Exports ------------------------------------------------------------------

export { lineIssues, lineView };
