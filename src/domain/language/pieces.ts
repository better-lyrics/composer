import { languagesWith, lineTransliteration } from "@/domain/language/line-languages";
import type {
  BackgroundLanguage,
  LanguagePiece,
  LanguagePieces,
  LanguageSide,
  LineLanguage,
  LineLanguages,
} from "@/domain/language/model";
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

function trackPieces(line: LyricLine, side: LanguageSide): LanguagePieces | undefined {
  return line.languages?.transliteration?.[side]?.pieces;
}

function withSidePieces<T extends BackgroundLanguage>(track: T, pieces: LanguagePieces | undefined): T {
  const { pieces: _old, ...rest } = track;
  return (pieces ? { ...rest, pieces } : rest) as T;
}

// A side the language does not have holds no pieces, and a background side left with nothing is no side.
function withTrackPieces(language: LineLanguage, side: LanguageSide, pieces: LanguagePieces | undefined): LineLanguage {
  if (side === "main") return { ...language, main: withSidePieces(language.main, pieces) };
  if (!language.bg) return language;
  const { bg: _bg, ...rest } = language;
  const bg = withSidePieces(language.bg, pieces);
  return Object.keys(bg).length ? { ...rest, bg } : rest;
}

function withoutPieces(language: LineLanguage): LineLanguage {
  return withTrackPieces(withTrackPieces(language, "main", undefined), "bg", undefined);
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
  const track = lineTransliteration(line);
  if (!track) return line.languages;
  const pieces = regroupedPieces(before, after, trackPieces(aligned, side));
  return languagesWith(line.languages, { transliteration: withTrackPieces(track, side, pieces) });
}

// A write that replaced some syllables drops their pieces; syllables it kept as they were keep theirs.
function withKeptSyllablePieces(
  line: LyricLine,
  side: LanguageSide,
  before: readonly WordTiming[],
  after: readonly WordTiming[],
): LineLanguages | undefined {
  const track = lineTransliteration(line);
  if (!track) return line.languages;
  const kept = new Set(before);
  const pieces = trackPieces(line, side);
  const positional = after.map((word) => (kept.has(word) ? pieceOf(pieces, word) : undefined));
  return languagesWith(line.languages, {
    transliteration: withTrackPieces(track, side, keyedPieces(after, positional)),
  });
}

// Languages copied to a linked line keep that line's own pieces: they are keyed to its own syllables.
function withOwnPieces(languages: LineLanguages | undefined, line: LyricLine): LineLanguages | undefined {
  const track = languages?.transliteration;
  if (!track) return languages;
  const main = withTrackPieces(track, "main", trackPieces(line, "main"));
  return { ...languages, transliteration: withTrackPieces(main, "bg", trackPieces(line, "bg")) };
}

function withAddedPieces(
  languages: LineLanguages | undefined,
  side: LanguageSide,
  added: LanguagePieces,
): LineLanguages | undefined {
  const track = languages?.transliteration;
  if (!track || Object.keys(added).length === 0) return languages;
  const sideTrack = side === "main" ? track.main : (track.bg ?? {});
  const pieces = { ...sideTrack.pieces, ...added };
  const transliteration =
    side === "main"
      ? { ...track, main: withSidePieces(track.main, pieces) }
      : { ...track, bg: withSidePieces(sideTrack, pieces) };
  return { ...languages, transliteration };
}

// A line given another line's syllables takes that line's readings too, by position.
function withReadingsOf(line: LyricLine, source: LyricLine): LineLanguages | undefined {
  const track = lineTransliteration(line);
  if (!track) return line.languages;
  const main = keyedPieces(line.words ?? [], positionalPieces(source.words ?? [], trackPieces(source, "main")));
  const bg = keyedPieces(
    line.backgroundWords ?? [],
    positionalPieces(source.backgroundWords ?? [], trackPieces(source, "bg")),
  );
  const copied = withTrackPieces(withTrackPieces(track, "main", main), "bg", bg);
  return languagesWith(line.languages, { transliteration: copied });
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

function withoutOrphanHeldReadings<T extends LyricLine>(line: T): T {
  const held = line.languages?.heldReadings;
  if (!held) return line;
  const main = ownedPieces(held.main, line.words);
  const bg = ownedPieces(held.bg, line.backgroundWords);
  if (main === held.main && bg === held.bg) return line;
  const heldReadings = main || bg ? { ...(main && { main }), ...(bg && { bg }) } : undefined;
  return { ...line, languages: languagesWith(line.languages, { heldReadings }) };
}

// A piece is kept only while its syllable is on that side of the line.
function withoutOrphanPieces<T extends LyricLine>(line: T): T {
  const track = lineTransliteration(line);
  if (!track) return withoutOrphanHeldReadings(line);
  const main = ownedPieces(track.main.pieces, line.words);
  const bg = track.bg && ownedPieces(track.bg.pieces, line.backgroundWords);
  if (main === track.main.pieces && bg === track.bg?.pieces) return line;
  const kept = withTrackPieces(withTrackPieces(track, "main", main), "bg", bg);
  return { ...line, languages: languagesWith(line.languages, { transliteration: kept }) };
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
  withoutPieces,
  withReadingsOf,
  withSidePieces,
  withTrackPieces,
};
