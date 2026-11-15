import { type Passthrough, withRenamedAnchors } from "./passthrough";
import type { LineContent } from "./group-template-line";
import type { LanguagePieces, LineLanguage, LineLanguages } from "./language";
import type { LineTrack, Syllable } from "./line";

// -- Types --------------------------------------------------------------------

type IdRenames = Readonly<Record<string, string>>;
type Rename = ReadonlyMap<string, string>;

// -- Ids ----------------------------------------------------------------------

// Every id the line holds: its own, its tracks' and its syllables'. Ids made from the line id (`<line id>:main`,
// `<line id>:line`) follow the line they are on.
function lineRename(line: LineContent, toLineId: string, renames: IdRenames): Rename {
  const prefix = `${line.id}:`;
  const renamed = (id: string) =>
    renames[id] ?? (id.startsWith(prefix) ? `${toLineId}:${id.slice(prefix.length)}` : id);
  const rename = new Map<string, string>([[line.id, toLineId]]);
  for (const track of line.tracks) {
    rename.set(track.id, renamed(track.id));
    for (const syllable of track.syllables) rename.set(syllable.id, renamed(syllable.id));
  }
  return rename;
}

// -- Fields -------------------------------------------------------------------

function renamedPassthrough(kept: Passthrough | undefined, rename: Rename): Passthrough | undefined {
  return kept && withRenamedAnchors(kept, rename);
}

function renamedPieces(pieces: LanguagePieces | undefined, rename: Rename): LanguagePieces | undefined {
  return pieces && Object.fromEntries(Object.entries(pieces).map(([id, piece]) => [rename.get(id) ?? id, piece]));
}

function renamedLanguage(language: LineLanguage, rename: Rename): LineLanguage {
  const { main, bg } = language;
  return {
    ...language,
    main: main.pieces ? { ...main, pieces: renamedPieces(main.pieces, rename) } : main,
    ...(bg && { bg: bg.pieces ? { ...bg, pieces: renamedPieces(bg.pieces, rename) } : bg }),
  };
}

function renamedLanguages(languages: LineLanguages, rename: Rename): LineLanguages {
  const { translations, transliteration, heldReadings } = languages;
  return {
    ...languages,
    ...(translations && {
      translations: Object.fromEntries(
        Object.entries(translations).map(([tag, language]) => [tag, renamedLanguage(language, rename)]),
      ),
    }),
    ...(transliteration && { transliteration: renamedLanguage(transliteration, rename) }),
    ...(heldReadings && {
      heldReadings: {
        ...(heldReadings.main && { main: renamedPieces(heldReadings.main, rename) }),
        ...(heldReadings.bg && { bg: renamedPieces(heldReadings.bg, rename) }),
      },
    }),
  };
}

function renamedSyllable<S extends Syllable>(syllable: S, rename: Rename): S {
  const passthrough = renamedPassthrough(syllable.passthrough, rename);
  return { ...syllable, id: rename.get(syllable.id) ?? syllable.id, ...(passthrough && { passthrough }) };
}

function renamedTrack<T extends LineTrack>(track: T, rename: Rename): T {
  const syllables: readonly Syllable[] = track.syllables.map((syllable) => renamedSyllable(syllable, rename));
  const passthrough = track.role === "bg" ? renamedPassthrough(track.passthrough, rename) : undefined;
  return { ...track, id: rename.get(track.id) ?? track.id, syllables, ...(passthrough && { passthrough }) } as T;
}

// -- Functions ----------------------------------------------------------------

// The same content under another line's ids: tracks, syllables, the keys of syllable readings and the anchors kept
// TTML elements follow. Text is never touched.
function withLineIds<T extends LineContent>(line: T, toLineId: string, renames: IdRenames): T {
  if (line.id === toLineId && Object.keys(renames).length === 0) return line;
  const rename = lineRename(line, toLineId, renames);
  const [main, background] = line.tracks;
  const passthrough = renamedPassthrough(line.passthrough, rename);
  return {
    ...line,
    id: toLineId,
    tracks: background ? [renamedTrack(main, rename), renamedTrack(background, rename)] : [renamedTrack(main, rename)],
    ...(line.languages && { languages: renamedLanguages(line.languages, rename) }),
    ...(passthrough && { passthrough }),
  };
}

// Track and syllable ids of `from` paired with those of `to` by position, when both have the same shape; ids the
// line id already pairs are left out.
function pairedIds(from: LineContent, to: LineContent): Record<string, string> | null {
  if (from.tracks.length !== to.tracks.length) return null;
  const derived = lineRename(from, to.id, {});
  const pairs: Record<string, string> = {};
  const pair = (fromId: string, toId: string) => {
    if (derived.get(fromId) !== toId) pairs[fromId] = toId;
  };
  for (const [index, track] of from.tracks.entries()) {
    const other = to.tracks[index];
    if (track.role !== other.role || track.syllables.length !== other.syllables.length) return null;
    pair(track.id, other.id);
    track.syllables.forEach((syllable, position) => pair(syllable.id, other.syllables[position].id));
  }
  return pairs;
}

function invertedIds(renames: IdRenames): Record<string, string> {
  return Object.fromEntries(Object.entries(renames).map(([from, to]) => [to, from]));
}

// -- Exports ------------------------------------------------------------------

export { invertedIds, pairedIds, withLineIds };
