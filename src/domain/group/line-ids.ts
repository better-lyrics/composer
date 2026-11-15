import type { LineContent } from "@/domain/group/template-line";

// -- Types --------------------------------------------------------------------

type IdRenames = Readonly<Record<string, string>>;

// -- Helpers ------------------------------------------------------------------

// Ids made from a line id (`<line id>:main`, `<line id>:line`) follow the line they are on.
function lineIdRenamer(fromLineId: string, toLineId: string, renames: IdRenames): (id: string) => string {
  const prefix = `${fromLineId}:`;
  return (id) => renames[id] ?? (id.startsWith(prefix) ? `${toLineId}:${id.slice(prefix.length)}` : id);
}

function renamedDeep(value: unknown, rename: (id: string) => string): unknown {
  if (typeof value === "string") return rename(value);
  if (Array.isArray(value)) return value.map((item) => renamedDeep(item, rename));
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [rename(key), renamedDeep(item, rename)]));
}

// -- Functions ----------------------------------------------------------------

// The same content under another line's ids. Every id a line holds (tracks, syllables, the keys of syllable readings,
// the anchors kept TTML elements follow) is renamed wherever it appears; text never holds an id.
function withLineIds<T extends LineContent>(line: T, toLineId: string, renames: IdRenames): T {
  if (line.id === toLineId && Object.keys(renames).length === 0) return line;
  const rename = lineIdRenamer(line.id, toLineId, renames);
  const { id: _id, ...content } = line;
  return { id: toLineId, ...(renamedDeep(content, rename) as Omit<T, "id">) } as T;
}

// Track and syllable ids of `from` paired with those of `to` by position, when both have the same shape; ids that the
// line id already pairs are left out.
function pairedIds(from: LineContent, to: LineContent): Record<string, string> | null {
  if (from.tracks.length !== to.tracks.length) return null;
  const derived = lineIdRenamer(from.id, to.id, {});
  const pairs: Record<string, string> = {};
  const pair = (fromId: string, toId: string) => {
    if (derived(fromId) !== toId) pairs[fromId] = toId;
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
