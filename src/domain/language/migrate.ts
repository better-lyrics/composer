import { alignTrackToLine } from "@/domain/language/align";
import { lineTransliteration, withLanguages } from "@/domain/language/line-languages";
import { wholeLineSegments } from "@/domain/language/manual-segments";
import type { LanguagePieces, LineLanguage } from "@/domain/language/model";
import { mappedTransliteration, trackPieces } from "@/domain/language/pieces";
import { languageSourceText } from "@/domain/language/source-text";
import { DASHES, normalizeTransliterationForEditing, sourceWordCount } from "@/domain/language/transliteration-format";
import type { LyricLine } from "@/domain/line/model";
import { backgroundText, lineText } from "@/domain/line/text";
import { roleWords } from "@/domain/line/track";
import { spacedText } from "@/domain/word/spaced-words";
import type { WordTiming } from "@/domain/word/timing";

const SOFT_MARKER = "\uE004";
const WORD_MARKER = "\uE005";

function completeMappedText(
  sourceText: string,
  words: WordTiming[] | undefined,
  pieces: LanguagePieces | undefined,
): string | null {
  if (!words?.length) return null;
  const coveredText = spacedText(words);
  if (
    sourceWordCount(coveredText) !== sourceWordCount(sourceText) ||
    languageSourceText(coveredText) !== languageSourceText(sourceText)
  )
    return null;
  return mappedTransliteration(words, pieces);
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
  const track = lineTransliteration(line);
  if (!track || track.main.alignmentStatus !== undefined || track.bg?.alignmentStatus !== undefined) return line;

  const mappedMain = completeMappedText(lineText(line), roleWords(line, "main"), trackPieces(line, "main"));
  const main = mappedMain ? { text: mappedMain, ambiguous: false } : legacyDisplayText(lineText(line), track.main.text);
  const lineBackground = backgroundText(line);
  const mappedBackground = lineBackground
    ? completeMappedText(lineBackground, roleWords(line, "bg"), trackPieces(line, "bg"))
    : null;
  const background = track.bg?.text
    ? mappedBackground
      ? { text: mappedBackground, ambiguous: false }
      : legacyDisplayText(backgroundText(line) ?? "", track.bg.text)
    : null;
  const migratedTrack: LineLanguage = {
    ...track,
    main: { ...track.main, text: main.text, segments: wholeLineSegments(lineText(line), main.text) },
    ...(background && track.bg
      ? {
          bg: {
            ...track.bg,
            text: background.text,
            segments: wholeLineSegments(backgroundText(line) ?? "", background.text),
          },
        }
      : {}),
  };
  const alignedLine = { ...line, ...alignTrackToLine(line, migratedTrack) };
  const aligned = lineTransliteration(alignedLine);
  if (!aligned) return line;
  return {
    ...alignedLine,
    ...withLanguages(alignedLine, {
      transliteration: {
        ...aligned,
        main: { ...aligned.main, ...(main.ambiguous ? { alignmentStatus: "needs-review" } : {}) },
        ...(aligned.bg && {
          bg: { ...aligned.bg, ...(background?.ambiguous ? { alignmentStatus: "needs-review" } : {}) },
        }),
      },
    }),
  };
}

export { migrateLegacyTransliterationLine };
