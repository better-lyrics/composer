import type { Passthrough } from "./passthrough";
import type { LineLanguages } from "./language";
import type { WordTiming } from "./word-timing";

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
type BackgroundTrack = TrackTiming & {
  readonly role: "bg";
  readonly source?: BackgroundSource;
  // The x-bg container's unmodelled TTML data.
  readonly passthrough?: Passthrough;
};
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
  passthrough?: Passthrough;
}

interface LineUpdate {
  id: string;
  updates: Partial<LyricLine>;
}

// -- Exports ------------------------------------------------------------------

export type {
  BackgroundSource,
  BackgroundTrack,
  LineTrack,
  LineTracks,
  LineUpdate,
  LyricLine,
  MainTrack,
  SpanTimedTrack,
  Syllable,
  TrackRole,
  TrackTiming,
  UntimedSyllable,
};
