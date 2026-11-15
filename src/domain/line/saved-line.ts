import { isEmptyPassthrough } from "insync/passthrough";
import type { SavedLine, SavedSpan, SavedSyllable, SavedTrack } from "insync/saved-line";
import { msFromSeconds, secondsFromMs } from "insync/time";
import { languagesFromSaved, savedLanguages } from "@/domain/language/saved-languages";
import { groupFieldsOf } from "insync/line-group-fields";
import type {
  BackgroundTrack,
  LineTrack,
  LyricLine,
  MainTrack,
  Syllable,
  TrackTiming,
  UntimedSyllable,
} from "insync/line";
import { placesKeptElements } from "@/domain/line/passthrough";
import { backgroundTrack, isSpanTimed, isTimedSyllable, mainTrack } from "insync/line-track";
import { newWordId } from "insync/word-id";

// -- Types --------------------------------------------------------------------

interface SavedLineOptions {
  // Records keep syllable and track ids; links leave them out unless kept TTML elements are placed by them.
  withIds: boolean;
}

// -- Writing ------------------------------------------------------------------

function savedSpan(begin: number, end: number): SavedSpan {
  return [msFromSeconds(begin), msFromSeconds(end)];
}

function savedSyllable(syllable: Syllable, { withIds }: SavedLineOptions): SavedSyllable {
  return {
    ...(withIds && { id: syllable.id }),
    text: syllable.text,
    sep: syllable.sep,
    ...(syllable.joinsNext && { joinsNext: true }),
    ...(isTimedSyllable(syllable) && { span: savedSpan(syllable.begin, syllable.end) }),
    ...(syllable.explicit && { explicit: true }),
    ...(!isEmptyPassthrough(syllable.passthrough) && { passthrough: syllable.passthrough }),
  };
}

function savedTrack(track: LineTrack, options: SavedLineOptions): SavedTrack {
  return {
    ...(options.withIds && { id: track.id }),
    role: track.role,
    ...(track.role === "main" && { agent: track.agentId }),
    ...(track.role === "bg" && track.source && { source: track.source }),
    ...(isSpanTimed(track) && { span: savedSpan(track.begin, track.end) }),
    syllables: track.syllables.map((syllable) => savedSyllable(syllable, options)),
    ...(track.role === "bg" && !isEmptyPassthrough(track.passthrough) && { passthrough: track.passthrough }),
  };
}

function savedLine(line: LyricLine, options: SavedLineOptions): SavedLine {
  const main = mainTrack(line);
  const background = backgroundTrack(line);
  const languages =
    line.languages && savedLanguages(line.languages, { main: main.syllables, bg: background?.syllables ?? [] });
  return {
    id: line.id,
    tracks: line.tracks.map((track) => savedTrack(track, placesKeptElements(line) ? { withIds: true } : options)),
    ...(languages && { languages }),
    ...groupFieldsOf(line),
    ...(!isEmptyPassthrough(line.passthrough) && { passthrough: line.passthrough }),
  };
}

// -- Reading ------------------------------------------------------------------

function untimedFromSaved(saved: SavedSyllable, id: string): UntimedSyllable {
  return {
    id,
    text: saved.text,
    sep: saved.sep,
    joinsNext: saved.joinsNext === true,
    ...(saved.explicit && { explicit: true }),
    ...(saved.passthrough && { passthrough: saved.passthrough }),
  };
}

// A syllable keeps its saved id unless it has none or another syllable of its track took it first.
function syllablesFromSaved(saved: readonly SavedSyllable[]): Syllable[] {
  const taken = new Set<string>();
  return saved.map((syllable) => {
    const id = syllable.id !== undefined && !taken.has(syllable.id) ? syllable.id : newWordId();
    taken.add(id);
    const untimed = untimedFromSaved(syllable, id);
    if (!syllable.span) return untimed;
    return { ...untimed, begin: secondsFromMs(syllable.span[0]), end: secondsFromMs(syllable.span[1]) };
  });
}

// Timed syllables win over a track span, as they do when a line is built from fields.
function trackTimingFromSaved(saved: SavedTrack, fallbackId: string): TrackTiming {
  const id = saved.id ?? fallbackId;
  const syllables = syllablesFromSaved(saved.syllables);
  if (!saved.span || syllables.some(isTimedSyllable)) return { id, syllables };
  const untimed = syllables.map(({ begin: _begin, end: _end, ...syllable }) => syllable);
  return { id, syllables: untimed, begin: secondsFromMs(saved.span[0]), end: secondsFromMs(saved.span[1]) };
}

function mainFromSaved(saved: SavedTrack | undefined, lineId: string): MainTrack {
  const timing = trackTimingFromSaved(saved ?? { role: "main", syllables: [] }, `${lineId}:main`);
  return { ...timing, role: "main", agentId: saved?.agent ?? "" };
}

function backgroundFromSaved(saved: SavedTrack, lineId: string): BackgroundTrack {
  const timing = trackTimingFromSaved(saved, `${lineId}:bg`);
  return {
    ...timing,
    role: "bg",
    ...(saved.source && { source: saved.source }),
    ...(saved.passthrough && { passthrough: saved.passthrough }),
  };
}

function lineFromSaved(saved: SavedLine): LyricLine {
  let savedMain: SavedTrack | undefined;
  let savedBackground: SavedTrack | undefined;
  for (const track of saved.tracks) {
    if (track.role === "main") savedMain ??= track;
    else savedBackground ??= track;
  }
  const main = mainFromSaved(savedMain, saved.id);
  const background = savedBackground && backgroundFromSaved(savedBackground, saved.id);
  const languages =
    saved.languages && languagesFromSaved(saved.languages, { main: main.syllables, bg: background?.syllables ?? [] });
  return {
    id: saved.id,
    tracks: background ? [main, background] : [main],
    ...(languages && { languages }),
    ...groupFieldsOf(saved),
    ...(saved.passthrough && { passthrough: saved.passthrough }),
  };
}

// -- Exports ------------------------------------------------------------------

export { lineFromSaved, savedLine };
