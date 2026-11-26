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

/** The same warnings the Languages tab shows, as stable codes an agent can act on. */
function lineIssues(line: LyricLine): string[] {
  const issues = getLanguageReviewTracks(line).flatMap((track) =>
    track.kind === "translation"
      ? [`translation-source-changed:${track.language}`]
      : track.reasons.map((reason) =>
          reason === "alignment" ? "transliteration-alignment-needs-review" : "transliteration-source-changed",
        ),
  );
  const track = line.transliteration;
  if (track?.alignmentStatus === "unresolved" || track?.backgroundAlignmentStatus === "unresolved") {
    issues.push("transliteration-does-not-fit-syllables");
  }
  return issues;
}

function lineView(line: LyricLine, index: number): LineView {
  const track = line.transliteration;
  const translations = Object.entries(line.translations ?? {});
  return {
    lineId: line.id,
    number: index + 1,
    text: line.text,
    ...(line.backgroundText ? { backgroundText: line.backgroundText } : {}),
    timing: isWordSynced(line) ? "word" : isLineSynced(line) ? "line" : "none",
    ...(line.words?.length ? { syllables: syllables(line.words) } : {}),
    ...(line.backgroundWords?.length ? { backgroundSyllables: syllables(line.backgroundWords) } : {}),
    ...(track
      ? {
          transliteration: {
            language: track.language,
            text: track.text,
            ...(track.backgroundText ? { backgroundText: track.backgroundText } : {}),
            ...(track.alignmentStatus ? { alignment: track.alignmentStatus } : {}),
            ...(track.backgroundAlignmentStatus ? { backgroundAlignment: track.backgroundAlignmentStatus } : {}),
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
