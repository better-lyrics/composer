import { drawnSyllables } from "./line-drawn-track";
import { withAlignedWords } from "./language-align";
import { languageSourceFingerprint } from "./language-fingerprint";
import { languagesWith, lineTransliteration } from "./language-line-languages";
import { wholeLineSegments } from "./language-manual-segments";
import type {
  LanguagePiece,
  LanguagePieces,
  LanguageSide,
  LineLanguage,
  LineLanguages,
  TransliterationAlignmentStatus,
} from "./language";
import {
  type PositionalPieces,
  keyedPieces,
  languageSide,
  mappedTransliteration,
  pieceOf,
  positionalPieces,
  trackPieces,
} from "./language-pieces";
import { withPiecesOn, withTrackPieces } from "./language-side-pieces";
import type { LyricLine } from "./line";
import { backgroundText, lineText, syllablesText } from "./line-text";
import { withRoleWords } from "./line-track-writes";
import { trackRole, trackWords, type WordTrack } from "./line-track";
import type { WordTiming } from "./word-timing";

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

function sideSourceText(line: LyricLine, side: LanguageSide, splitChar: string): string {
  return side === "main" ? lineText(line, splitChar) : (backgroundText(line, splitChar) ?? "");
}

function trackWithText(
  line: LyricLine,
  track: LineLanguage,
  side: LanguageSide,
  text: string,
  status: TransliterationAlignmentStatus | undefined,
  splitChar: string,
): LineLanguage {
  const { stale: _stale, ...current } = track;
  const segments =
    side === "main"
      ? wholeLineSegments(lineText(line, splitChar), text)
      : [{ original: sideSourceText(line, side, splitChar), transliteration: text }];
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

// What every split takes: the word at `wordIndex` of the track becomes `replacementWords`.
type SplitArguments = [
  line: LyricLine,
  type: WordTrack,
  wordIndex: number,
  replacementWords: WordTiming[],
  splitChar: string,
  replacementPieces?: PositionalPieces,
];

function splitKeepingPieces(
  ...[line, type, wordIndex, replacementWords, splitChar, replacementPieces]: SplitArguments
): PiecedSplit | null {
  const effective = drawnSyllables(line, trackRole(type), splitChar);
  if (!effective?.length) return null;
  const side = languageSide(type);
  const aligned = withAlignedWords(withRoleWords(line, trackRole(type), effective), splitChar);
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
  return {
    words,
    pieces,
    transliteration: trackWithText(line, track, side, text, track[side]?.alignmentStatus, splitChar),
  };
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

function splitWordsKeepingTransliteration(...args: SplitArguments): WordSplitResult | null {
  const [line, type] = args;
  const split = splitKeepingPieces(...args);
  return split && { words: split.words, languages: splitLanguages(line, type, split, split.transliteration) };
}

// Splitting a word into words inserts a space into the source text, so the
// track is re-stamped against the new text. The rejoined text is mechanical, so
// the track keeps its origin. A track that was already out of date keeps its
// old fingerprint.
function splitWordIntoWordsKeepingTransliteration(...args: SplitArguments): WordSplitResult | null {
  const [line, type, , , splitChar] = args;
  const split = splitKeepingPieces(...args);
  const track = lineTransliteration(line);
  if (!split || !track) return split && { words: split.words, languages: splitLanguages(line, type, split, null) };

  const side = languageSide(type);
  const hasEditedSide = Boolean(track[side]?.text?.trim());
  const wasCurrent =
    track.sourceFingerprint ===
    languageSourceFingerprint(splitChar, lineText(line, splitChar), backgroundText(line, splitChar));
  // Only the other side has a transliteration: nothing to rewrite, but the
  // fingerprint still has to follow the new source text.
  const reconciled = split.transliteration ?? (hasEditedSide || !wasCurrent ? null : track);
  if (!reconciled) return { words: split.words, languages: splitLanguages(line, type, split, null) };

  const splitText = syllablesText(split.words, splitChar);
  const text = type === "word" ? splitText : lineText(line, splitChar);
  const background = type === "bg" ? splitText : backgroundText(line, splitChar);
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
    sourceFingerprint: wasCurrent ? languageSourceFingerprint(splitChar, text, background) : track.sourceFingerprint,
  };
  return { words: split.words, languages: splitLanguages(line, type, split, written) };
}

// -- Exports ------------------------------------------------------------------

export { splitWordIntoWordsKeepingTransliteration, splitWordsKeepingTransliteration };

export type { WordSplitResult };
