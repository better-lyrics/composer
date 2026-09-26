import { alignTrackToLine, mappedTransliteration } from "@/domain/language/align";
import type { TransliterationTrack } from "@/domain/language/model";
import { languageSourceText } from "@/domain/language/source-text";
import { DASHES, normalizeTransliterationForEditing, sourceWordCount } from "@/domain/language/transliteration-format";
import { type LyricLine, reconcileLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";

const SOFT_MARKER = "\uE004";
const WORD_MARKER = "\uE005";

function completeMappedText(sourceText: string, words?: WordTiming[]): string | null {
  if (!words?.length) return null;
  const coveredText = words.map((word) => word.text).join("");
  if (
    sourceWordCount(coveredText) !== sourceWordCount(sourceText) ||
    languageSourceText(coveredText) !== languageSourceText(sourceText)
  )
    return null;
  return mappedTransliteration(words);
}

function legacyDisplayText(sourceText: string, value: string): { text: string; ambiguous: boolean } {
  const sourceHasDash = DASHES.test(sourceText);
  DASHES.lastIndex = 0;
  let text = value.trim().replace(/\s+/g, WORD_MARKER);
  if (!sourceHasDash) text = text.replace(DASHES, SOFT_MARKER);
  DASHES.lastIndex = 0;
  const ambiguous = sourceHasDash && DASHES.test(value);
  DASHES.lastIndex = 0;
  return {
    text: normalizeTransliterationForEditing(
      text.replace(new RegExp(SOFT_MARKER, "g"), " ").replace(new RegExp(WORD_MARKER, "g"), "  "),
    ),
    ambiguous,
  };
}

function migrateLegacyTransliterationLine(line: LyricLine): LyricLine {
  const track = line.transliteration;
  if (!track || track.alignmentStatus !== undefined || track.backgroundAlignmentStatus !== undefined) return line;

  const mappedMain = completeMappedText(line.text, line.words);
  const main = mappedMain ? { text: mappedMain, ambiguous: false } : legacyDisplayText(line.text, track.text);
  const mappedBackground = line.backgroundText ? completeMappedText(line.backgroundText, line.backgroundWords) : null;
  const background = track.backgroundText
    ? mappedBackground
      ? { text: mappedBackground, ambiguous: false }
      : legacyDisplayText(line.backgroundText ?? "", track.backgroundText)
    : null;
  const migratedTrack: TransliterationTrack = {
    ...track,
    text: main.text,
    ...(background ? { backgroundText: background.text } : {}),
    segments: [{ original: line.text, transliteration: main.text }],
    ...(background
      ? { backgroundSegments: [{ original: line.backgroundText ?? "", transliteration: background.text }] }
      : {}),
  };
  const aligned = alignTrackToLine(line, migratedTrack);
  const alignedTrack = aligned.transliteration as TransliterationTrack;
  return reconcileLine({
    ...line,
    ...aligned,
    transliteration: {
      ...alignedTrack,
      ...(main.ambiguous ? { alignmentStatus: "needs-review" } : {}),
      ...(background?.ambiguous ? { backgroundAlignmentStatus: "needs-review" } : {}),
    },
  });
}

export { migrateLegacyTransliterationLine };
