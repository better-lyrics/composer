import type { GridLines } from "@/domain/tempo/grid-points";

// -- Types ---------------------------------------------------------------------

type SnapSource = "words" | "markers" | "onsets" | "beats" | "playhead";

interface SnapSettings {
  timelineSnap: boolean;
  snapWordsAndLines: boolean;
  snapMarkers: boolean;
  vocalOnsetSnap: boolean;
  beatSnap: boolean;
  snapToPlayhead: boolean;
  snapDistanceWords: number;
  snapDistanceMarkers: number;
  snapDistanceOnsets: number;
  snapDistanceBeats: number;
  snapDistancePlayhead: number;
  beatGridVisible: boolean;
  beatGridLines: GridLines;
  snapPlayheadToPoints: boolean;
}

type SnapSwitchKey = keyof Pick<
  SnapSettings,
  "snapWordsAndLines" | "snapMarkers" | "vocalOnsetSnap" | "beatSnap" | "snapToPlayhead"
>;

type SnapDistanceKey = keyof Pick<
  SnapSettings,
  "snapDistanceWords" | "snapDistanceMarkers" | "snapDistanceOnsets" | "snapDistanceBeats" | "snapDistancePlayhead"
>;

// -- Defaults ------------------------------------------------------------------

const DEFAULT_SNAP_DISTANCE_PX = 12;
const SNAP_DISTANCE_RANGE_PX = { min: 4, max: 24 } as const;

const SNAP_DEFAULTS: SnapSettings = {
  timelineSnap: true,
  snapWordsAndLines: true,
  snapMarkers: true,
  vocalOnsetSnap: true,
  beatSnap: true,
  snapToPlayhead: true,
  snapDistanceWords: DEFAULT_SNAP_DISTANCE_PX,
  snapDistanceMarkers: DEFAULT_SNAP_DISTANCE_PX,
  snapDistanceOnsets: DEFAULT_SNAP_DISTANCE_PX,
  snapDistanceBeats: DEFAULT_SNAP_DISTANCE_PX,
  snapDistancePlayhead: DEFAULT_SNAP_DISTANCE_PX,
  beatGridVisible: true,
  beatGridLines: "2",
  snapPlayheadToPoints: true,
};

const SNAP_SWITCH_SETTING: Record<SnapSource, SnapSwitchKey> = {
  words: "snapWordsAndLines",
  markers: "snapMarkers",
  onsets: "vocalOnsetSnap",
  beats: "beatSnap",
  playhead: "snapToPlayhead",
};

const SNAP_DISTANCE_SETTING: Record<SnapSource, SnapDistanceKey> = {
  words: "snapDistanceWords",
  markers: "snapDistanceMarkers",
  onsets: "snapDistanceOnsets",
  beats: "snapDistanceBeats",
  playhead: "snapDistancePlayhead",
};

// -- Functions -----------------------------------------------------------------

function snapDistancePx(settings: Pick<SnapSettings, SnapDistanceKey>, source: SnapSource): number {
  return settings[SNAP_DISTANCE_SETTING[source]];
}

// -- Exports -------------------------------------------------------------------

export { SNAP_DEFAULTS, SNAP_DISTANCE_RANGE_PX, SNAP_DISTANCE_SETTING, SNAP_SWITCH_SETTING, snapDistancePx };
export type { SnapSettings, SnapSource, SnapSwitchKey };
