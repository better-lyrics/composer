import { drawnSyllables } from "@/domain/line/drawn-track";
import { withAlignedWords } from "@/domain/language/align";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import { languagesWith, lineTransliteration } from "@/domain/language/line-languages";
import { wholeLineSegments } from "@/domain/language/manual-segments";
import type {
  LanguagePiece,
  LanguagePieces,
  LanguageSide,
  LineLanguage,
  LineLanguages,
  TransliterationAlignmentStatus,
} from "@/domain/language/model";
import {
  type PositionalPieces,
  keyedPieces,
  languageSide,
  mappedTransliteration,
  pieceOf,
  positionalPieces,
  trackPieces,
} from "@/domain/language/pieces";
import { withPiecesOn, withTrackPieces } from "@/domain/language/side-pieces";
import type { LyricLine } from "@/domain/line/model";
import { backgroundText, lineText, syllablesText } from "@/domain/line/text";
import { withRoleWords } from "@/domain/line/track-writes";
import { trackRole, trackWords, type WordTrack } from "@/domain/line/track";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

interface WordSplitResult {
  words: WordTiming[];
  languages: LineLanguages | undefined;
}

interface PiecedSplit {
  words: WordTiming[];
  pieces: LanguagePieces | undefined;
  transliteration: LineLanguage | null;
}

// -- Functions ----------------------------------------------------------------

function sideSourceText(line: LyricLine, side: LanguageSide): string {
  return side === "main" ? lineText(line) : (backgroundText(line) ?? "");
}

function trackWithText(
  line: LyricLine,
  track: LineLanguage,
  side: LanguageSide,
  text: string,
  status: TransliterationAlignmentStatus | undefined,
): LineLanguage {
  const { stale: _stale, ...current } = track;
  const segments =
    side === "main"
      ? wholeLineSegments(lineText(line), text)
      : [{ original: sideSourceText(line, side), transliteration: text }];
  return { ...current, origin: "manual", [side]: { ...current[side], text, segments, alignmentStatus: status } };
}

function compactPiece(value: string | null | undefined): string {
  return value?.replace(/\s+/g, "") ?? "";
}

// A split moves boundaries only: its pieces must spell the split word's piece.
function keepsSplitPiece(
  splitPiece: LanguagePiece | undefined,
  replacementWords: WordTiming[],
  replacementPieces: PositionalPieces | undefined,
): replacementPieces is PositionalPieces {
  const piece = compactPiece(splitPiece?.text);
  if (piece === "" || !replacementPieces) return false;
  const pieces = keyedPieces(replacementWords, replacementPieces);
  return compactPiece(mappedTransliteration(replacementWords, pieces)) === piece;
}

function splitKeepingPieces(
  line: LyricLine,
  type: WordTrack,
  wordIndex: number,
  replacementWords: WordTiming[],
  replacementPieces: PositionalPieces | undefined,
): PiecedSplit | null {
  const effective = drawnSyllables(line, trackRole(type));
  if (!effective?.length) return null;
  const side = languageSide(type);
  const aligned = withAlignedWords(withRoleWords(line, trackRole(type), effective));
  const base = trackWords(aligned, type) ?? effective;
  const basePieces = trackPieces(aligned, side);

  const words = base.toSpliced(wordIndex, 1, ...replacementWords);
  const kept = keepsSplitPiece(pieceOf(basePieces, base[wordIndex]), replacementWords, replacementPieces);
  const pieces = keyedPieces(
    words,
    positionalPieces(base, basePieces).toSpliced(
      wordIndex,
      1,
      ...(kept ? replacementPieces : replacementWords.map(() => undefined)),
    ),
  );
  const track = lineTransliteration(aligned);
  const text = track ? mappedTransliteration(words, pieces) : null;
  if (!track || text === null) return { words, pieces, transliteration: null };
  return { words, pieces, transliteration: trackWithText(line, track, side, text, track[side]?.alignmentStatus) };
}

// The written track carries the split side's new pieces; the other side keeps the pieces the line stored.
function splitLanguages(
  line: LyricLine,
  type: WordTrack,
  split: PiecedSplit,
  written: LineLanguage | null,
): LineLanguages | undefined {
  const side = languageSide(type);
  const other = side === "main" ? "bg" : "main";
  const languages = written
    ? languagesWith(line.languages, { transliteration: withTrackPieces(written, other, trackPieces(line, other)) })
    : line.languages;
  return withPiecesOn(languages, side, split.pieces);
}

function splitWordsKeepingTransliteration(
  line: LyricLine,
  type: WordTrack,
  wordIndex: number,
  replacementWords: WordTiming[],
  replacementPieces?: PositionalPieces,
): WordSplitResult | null {
  const split = splitKeepingPieces(line, type, wordIndex, replacementWords, replacementPieces);
  return split && { words: split.words, languages: splitLanguages(line, type, split, split.transliteration) };
}

// Splitting a word into words inserts a space into the source text, so the
// track is re-stamped against the new text. The rejoined text is mechanical, so
// the track keeps its origin. A track that was already out of date keeps its
// old fingerprint.
function splitWordIntoWordsKeepingTransliteration(
  line: LyricLine,
  type: WordTrack,
  wordIndex: number,
  replacementWords: WordTiming[],
  splitChar: string,
  replacementPieces?: PositionalPieces,
): WordSplitResult | null {
  const split = splitKeepingPieces(line, type, wordIndex, replacementWords, replacementPieces);
  const track = lineTransliteration(line);
  if (!split || !track) return split && { words: split.words, languages: splitLanguages(line, type, split, null) };

  const side = languageSide(type);
  const hasEditedSide = Boolean(track[side]?.text?.trim());
  const wasCurrent = track.sourceFingerprint === languageSourceFingerprint(lineText(line), backgroundText(line));
  // Only the other side has a transliteration: nothing to rewrite, but the
  // fingerprint still has to follow the new source text.
  const reconciled = split.transliteration ?? (hasEditedSide || !wasCurrent ? null : track);
  if (!reconciled) return { words: split.words, languages: splitLanguages(line, type, split, null) };

  const splitText = syllablesText(split.words, splitChar);
  const text = type === "word" ? splitText : lineText(line);
  const background = type === "bg" ? splitText : backgroundText(line);
  const { stale: _stale, ...fresh } = reconciled;
  const sideTrack = fresh[side];
  const segments =
    !hasEditedSide || !sideTrack
      ? {}
      : {
          [side]: {
            ...sideTrack,
            segments:
              side === "main"
                ? wholeLineSegments(text, sideTrack.text ?? "")
                : [{ original: background ?? "", transliteration: sideTrack.text ?? "" }],
          },
        };

  const written: LineLanguage = {
    ...fresh,
    ...segments,
    origin: track.origin,
    sourceFingerprint: wasCurrent ? languageSourceFingerprint(text, background) : track.sourceFingerprint,
  };
  return { words: split.words, languages: splitLanguages(line, type, split, written) };
}

// -- Exports ------------------------------------------------------------------

export { splitWordIntoWordsKeepingTransliteration, splitWordsKeepingTransliteration };

export type { WordSplitResult };
