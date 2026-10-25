import type { GridLines } from "@/domain/tempo/grid-points";

// -- Types ---------------------------------------------------------------------

interface SnapSettings {
  timelineSnap: boolean;
  timelineSnapThreshold: number;
  snapWordsAndLines: boolean;
  snapMarkers: boolean;
  vocalOnsetSnap: boolean;
  beatSnap: boolean;
  beatGridVisible: boolean;
  beatGridLines: GridLines;
  snapPlayheadToPoints: boolean;
}

// -- Defaults ------------------------------------------------------------------

const SNAP_DEFAULTS: SnapSettings = {
  timelineSnap: true,
  timelineSnapThreshold: 12,
  snapWordsAndLines: true,
  snapMarkers: true,
  vocalOnsetSnap: true,
  beatSnap: true,
  beatGridVisible: true,
  beatGridLines: "2",
  snapPlayheadToPoints: true,
};

// -- Exports -------------------------------------------------------------------

export { SNAP_DEFAULTS };
export type { SnapSettings };
