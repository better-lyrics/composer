// -- Types --------------------------------------------------------------------

type PlacementKind = "pointer" | "keyboard";

interface Placement {
  cue: number | null;
  time: number;
  kind: PlacementKind;
  playing: boolean;
}

interface TransportState {
  latched: boolean;
  cue: number | null;
  playhead: number;
}

// -- Functions ----------------------------------------------------------------

// A click is a deliberate placement; keys pressed while listening only navigate.
function cueAfterPlacement({ cue, time, kind, playing }: Placement): number | null {
  return kind === "pointer" || !playing ? time : cue;
}

// Where transport play starts and where a stop leaves the playhead.
function transportPosition({ latched, cue, playhead }: TransportState): number {
  return latched && cue !== null ? cue : playhead;
}

// -- Exports ------------------------------------------------------------------

export { cueAfterPlacement, transportPosition };
export type { PlacementKind };
