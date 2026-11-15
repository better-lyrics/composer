import type { LineTrack, LyricLine, Syllable } from "insync/line";
import { isSpanTimed, isTimedSyllable } from "insync/line-track";

// -- Types --------------------------------------------------------------------

interface Edge {
  begin: boolean;
  end: boolean;
}

interface Moved {
  begins: number[];
  ends: number[];
}

// -- Helpers ------------------------------------------------------------------

function movedEdges(before: LineTrack | undefined, after: LineTrack): Map<Syllable | LineTrack, Edge> {
  const moved = new Map<Syllable | LineTrack, Edge>();
  if (isSpanTimed(after)) {
    const span = before && isSpanTimed(before) ? before : undefined;
    const edge = { begin: span?.begin !== after.begin, end: span?.end !== after.end };
    if (edge.begin || edge.end) moved.set(after, edge);
    return moved;
  }
  const beforeById = new Map(before?.syllables.map((syllable) => [syllable.id, syllable]));
  for (const syllable of after.syllables) {
    if (!isTimedSyllable(syllable)) continue;
    const old = beforeById.get(syllable.id);
    const edge = { begin: old?.begin !== syllable.begin, end: old?.end !== syllable.end };
    if (edge.begin || edge.end) moved.set(syllable, edge);
  }
  return moved;
}

function movedTimes(edges: ReadonlyMap<Syllable | LineTrack, Edge>): Moved {
  const moved: Moved = { begins: [], ends: [] };
  for (const [timed, edge] of edges) {
    if (timed.begin === undefined || timed.end === undefined) continue;
    if (edge.begin) moved.begins.push(timed.begin);
    if (edge.end) moved.ends.push(timed.end);
  }
  return moved;
}

function shiftedTrack<T extends LineTrack>(track: T, edges: ReadonlyMap<Syllable | LineTrack, Edge>, shift: number): T {
  const ownEdge = edges.get(track);
  if (ownEdge && isSpanTimed(track)) {
    return {
      ...track,
      begin: ownEdge.begin ? track.begin + shift : track.begin,
      end: ownEdge.end ? track.end + shift : track.end,
    };
  }
  if (!track.syllables.some((syllable) => edges.has(syllable))) return track;
  const syllables = track.syllables.map((syllable) => {
    const edge = edges.get(syllable);
    if (!edge || !isTimedSyllable(syllable)) return syllable;
    return {
      ...syllable,
      begin: edge.begin ? syllable.begin + shift : syllable.begin,
      end: edge.end ? syllable.end + shift : syllable.end,
    };
  });
  return { ...track, syllables } as T;
}

// -- Functions ----------------------------------------------------------------

// A shared timing edit placed at every offset stays inside the song: the times it moved shift by the least that
// keeps every instance at or after zero and, when there is room, at or before the song end.
function clampedToRoom(
  before: LyricLine | undefined,
  line: LyricLine,
  offsets: readonly number[],
  songEnd: number,
): LyricLine {
  const edges = new Map<Syllable | LineTrack, Edge>();
  line.tracks.forEach((track, index) => {
    for (const [timed, edge] of movedEdges(before?.tracks[index], track)) edges.set(timed, edge);
  });
  const { begins, ends } = movedTimes(edges);
  if (begins.length === 0 && ends.length === 0) return line;
  const all = [0, ...offsets];
  const earliest = Math.min(...begins, ...ends);
  const latest = Math.max(...begins, ...ends);
  const lowest = Math.max(...all.map((offset) => -(earliest + offset)));
  const highest = Math.min(...all.map((offset) => songEnd - (latest + offset)));
  const shift = lowest > 0 ? lowest : highest < 0 ? Math.max(highest, lowest) : 0;
  if (shift === 0) return line;
  const [main, background] = line.tracks;
  const tracks = background
    ? ([shiftedTrack(main, edges, shift), shiftedTrack(background, edges, shift)] as const)
    : ([shiftedTrack(main, edges, shift)] as const);
  return { ...line, tracks };
}

// -- Exports ------------------------------------------------------------------

export { clampedToRoom };
