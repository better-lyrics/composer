import type { LineLanguages } from "@/domain/language/model";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

type UntimedSyllable = Omit<WordTiming, "begin" | "end"> & { begin?: never; end?: never };
type Syllable = WordTiming | UntimedSyllable;
type TrackRole = "main" | "bg";
type BackgroundSource = "extraction" | "manual";

// A track is timed by its syllables (timed ones first, then the untimed rest) or by one span over untimed
// syllables. The `never` constraints make a track with both a span and timed syllables a compile error.
interface SyllableTimedTrack {
  readonly id: string;
  readonly syllables: readonly Syllable[];
  readonly begin?: never;
  readonly end?: never;
}

interface SpanTimedTrack {
  readonly id: string;
  readonly syllables: readonly UntimedSyllable[];
  readonly begin: number;
  readonly end: number;
}

type TrackTiming = SyllableTimedTrack | SpanTimedTrack;

type MainTrack = TrackTiming & { readonly role: "main"; readonly agentId: string };
type BackgroundTrack = TrackTiming & { readonly role: "bg"; readonly source?: BackgroundSource };
type LineTrack = MainTrack | BackgroundTrack;

type LineTracks = readonly [MainTrack] | readonly [MainTrack, BackgroundTrack];

interface LyricLine {
  id: string;
  tracks: LineTracks;
  languages?: LineLanguages;
  groupId?: string;
  instanceIdx?: number;
  templateLineIdx?: number;
  detached?: boolean;
}

const effectiveLineBrand: unique symbol = Symbol("effectiveLine");

type RawLine = LyricLine & { readonly [effectiveLineBrand]?: never };

interface LineUpdate {
  id: string;
  updates: Partial<LyricLine>;
}

// -- Exports ------------------------------------------------------------------

export { effectiveLineBrand };

export type {
  BackgroundSource,
  BackgroundTrack,
  LineTrack,
  LineUpdate,
  LyricLine,
  MainTrack,
  RawLine,
  SpanTimedTrack,
  Syllable,
  TrackRole,
  TrackTiming,
  UntimedSyllable,
};
