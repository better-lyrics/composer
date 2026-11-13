import type { LanguagePiece, LanguagePieces, LanguageSide, LineLanguages } from "@/domain/language/model";
import { sidePieces, withPiecesOn } from "@/domain/language/side-pieces";
import { hasLexicalBoundaryAfter, type TransliterationSlice } from "@/domain/language/transliteration-format";
import type { LyricLine } from "@/domain/line/model";
import type { WordTrack } from "@/domain/line/tracks";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

type PositionalPieces = readonly (LanguagePiece | undefined)[];

// -- Sides --------------------------------------------------------------------

function languageSide(type: WordTrack): LanguageSide {
  return type === "word" ? "main" : "bg";
}

function trackPieces(line: Pick<LyricLine, "languages">, side: LanguageSide): LanguagePieces | undefined {
  return sidePieces(line.languages, side);
}

// -- Reads --------------------------------------------------------------------

function pieceOf(pieces: LanguagePieces | undefined, word: WordTiming): LanguagePiece | undefined {
  return pieces?.[word.id];
}

function positionalPieces(words: readonly WordTiming[], pieces: LanguagePieces | undefined): PositionalPieces {
  return words.map((word) => pieceOf(pieces, word));
}

function keyedPieces(words: readonly WordTiming[], positional: PositionalPieces): LanguagePieces | undefined {
  const entries = words.flatMap((word, index) => {
    const piece = positional[index];
    return piece ? [[word.id, piece] as const] : [];
  });
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function legacyJoiner(words: readonly WordTiming[], pieces: LanguagePieces | undefined, index: number): string {
  return pieceOf(pieces, words[index])?.joinerAfter ?? (hasLexicalBoundaryAfter([...words], index) ? "  " : " ");
}

function mappedTransliteration(words: readonly WordTiming[], pieces: LanguagePieces | undefined): string | null {
  if (!words.length || words.some((word) => pieceOf(pieces, word)?.text === undefined)) return null;
  return words
    .map(
      (word, index) =>
        `${pieceOf(pieces, word)?.text}${index < words.length - 1 ? legacyJoiner(words, pieces, index) : ""}`,
    )
    .join("");
}

// -- Writes -------------------------------------------------------------------

// Every syllable takes its slice; the last keeps the joiner it already had to the syllable after the run.
function slicedPieces(
  words: readonly WordTiming[],
  slices: readonly TransliterationSlice[],
  pieces: LanguagePieces | undefined,
): LanguagePieces | undefined {
  return keyedPieces(
    words,
    words.map((word, index) => {
      if (index < words.length - 1)
        return { text: slices[index]?.text ?? "", joinerAfter: slices[index]?.joinerAfter ?? "" };
      const outer = pieceOf(pieces, word)?.joinerAfter;
      return { text: slices[index]?.text ?? "", ...(outer !== undefined && { joinerAfter: outer }) };
    }),
  );
}

function mergedPieceText(run: readonly WordTiming[], pieces: LanguagePieces | undefined): string | undefined {
  const parts: string[] = [];
  for (let index = 0; index < run.length; index++) {
    const part = pieceOf(pieces, run[index])?.text?.trim();
    if (!part) return undefined;
    if (index > 0) parts.push(pieceOf(pieces, run[index - 1])?.joinerAfter ?? " ");
    parts.push(part);
  }
  return parts.join("");
}

function mergedPiece(run: readonly WordTiming[], pieces: LanguagePieces | undefined): LanguagePiece | undefined {
  const text = mergedPieceText(run, pieces);
  const joinerAfter = run.length ? pieceOf(pieces, run[run.length - 1])?.joinerAfter : undefined;
  if (text === undefined && joinerAfter === undefined) return undefined;
  return { ...(text !== undefined && { text }), ...(joinerAfter !== undefined && { joinerAfter }) };
}

// Syllables merged into one keep the first one's id, so each one after a merge covers the syllables from its id up
// to the next one's. A syllable the old words never held has no piece.
function regroupedPieces(
  before: readonly WordTiming[],
  after: readonly WordTiming[],
  pieces: LanguagePieces | undefined,
): LanguagePieces | undefined {
  if (!pieces) return undefined;
  const indexById = new Map(before.map((word, index) => [word.id, index]));
  return keyedPieces(
    after,
    after.map((word, index) => {
      const start = indexById.get(word.id);
      if (start === undefined) return undefined;
      const next = index + 1 < after.length ? indexById.get(after[index + 1].id) : before.length;
      const run = next !== undefined && next > start ? before.slice(start, next) : [before[start]];
      return run.length === 1 ? pieceOf(pieces, run[0]) : mergedPiece(run, pieces);
    }),
  );
}

function regroupedLanguages(
  line: LyricLine,
  aligned: LyricLine,
  side: LanguageSide,
  before: readonly WordTiming[],
  after: readonly WordTiming[],
): LineLanguages | undefined {
  return withPiecesOn(line.languages, side, regroupedPieces(before, after, trackPieces(aligned, side)));
}

// A write that replaced some syllables drops their pieces; syllables it kept as they were keep theirs.
function withKeptSyllablePieces(
  line: LyricLine,
  side: LanguageSide,
  before: readonly WordTiming[],
  after: readonly WordTiming[],
): LineLanguages | undefined {
  const kept = new Set(before);
  const pieces = trackPieces(line, side);
  const positional = after.map((word) => (kept.has(word) ? pieceOf(pieces, word) : undefined));
  return withPiecesOn(line.languages, side, keyedPieces(after, positional));
}

// Languages copied to a linked line keep that line's own pieces: they are keyed to its own syllables.
function withOwnPieces(languages: LineLanguages | undefined, line: LyricLine): LineLanguages | undefined {
  const main = withPiecesOn(withPiecesOn(languages, "main", undefined), "main", trackPieces(line, "main"));
  return withPiecesOn(withPiecesOn(main, "bg", undefined), "bg", trackPieces(line, "bg"));
}

function withAddedPieces(
  languages: LineLanguages | undefined,
  side: LanguageSide,
  added: LanguagePieces,
): LineLanguages | undefined {
  if (Object.keys(added).length === 0) return languages;
  return withPiecesOn(languages, side, { ...sidePieces(languages, side), ...added });
}

// A line given another line's syllables takes that line's readings too, by position.
function withReadingsOf(line: LyricLine, source: LyricLine): LineLanguages | undefined {
  const copied = (
    side: LanguageSide,
    words: readonly WordTiming[] | undefined,
    from: readonly WordTiming[] | undefined,
  ) => keyedPieces(words ?? [], positionalPieces(from ?? [], trackPieces(source, side)));
  const main = withPiecesOn(line.languages, "main", copied("main", line.words, source.words));
  return withPiecesOn(main, "bg", copied("bg", line.backgroundWords, source.backgroundWords));
}

// -- Orphans ------------------------------------------------------------------

function ownedPieces(
  pieces: LanguagePieces | undefined,
  words: readonly WordTiming[] | undefined,
): LanguagePieces | undefined {
  if (!pieces) return undefined;
  const ids = new Set(words?.map((word) => word.id));
  const keys = Object.keys(pieces);
  if (keys.every((id) => ids.has(id))) return pieces;
  const kept = keys.filter((id) => ids.has(id));
  return kept.length ? Object.fromEntries(kept.map((id) => [id, pieces[id]])) : undefined;
}

// A piece is kept only while its syllable is on that side of the line.
function withoutOrphanPieces<T extends LyricLine>(line: T): T {
  const main = trackPieces(line, "main");
  const bg = trackPieces(line, "bg");
  const ownedMain = ownedPieces(main, line.words);
  const ownedBg = ownedPieces(bg, line.backgroundWords);
  if (ownedMain === main && ownedBg === bg) return line;
  return { ...line, languages: withPiecesOn(withPiecesOn(line.languages, "main", ownedMain), "bg", ownedBg) };
}

// -- Exports ------------------------------------------------------------------

export type { PositionalPieces };
export {
  keyedPieces,
  languageSide,
  mappedTransliteration,
  mergedPiece,
  pieceOf,
  positionalPieces,
  regroupedLanguages,
  regroupedPieces,
  slicedPieces,
  trackPieces,
  withAddedPieces,
  withKeptSyllablePieces,
  withOwnPieces,
  withoutOrphanPieces,
  withReadingsOf,
};
