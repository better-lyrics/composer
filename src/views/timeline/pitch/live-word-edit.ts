import type { Bounds } from "@/domain/word/bounds";
import type { PitchLaneKind } from "@/views/timeline/pitch/draw-pitch-lane";
import { useSyncExternalStore } from "react";

// -- Types ---------------------------------------------------------------------

interface LiveWordEdit {
  lineId: string;
  kind: PitchLaneKind;
  words: ReadonlyMap<number, Bounds>;
}

// -- State ---------------------------------------------------------------------

// An edge drag keeps its timing local until release; this lets the pitch lane of that one row follow it live.
let current: LiveWordEdit | null = null;
const listeners = new Set<() => void>();

// -- Functions -----------------------------------------------------------------

function setLiveWordEdit(edit: LiveWordEdit | null): void {
  if (edit === current) return;
  current = edit;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function useLiveWordEdit(lineId: string, kind: PitchLaneKind): LiveWordEdit | null {
  return useSyncExternalStore(subscribe, () =>
    current && current.lineId === lineId && current.kind === kind ? current : null,
  );
}

// -- Exports -------------------------------------------------------------------

export { setLiveWordEdit, useLiveWordEdit };
export type { LiveWordEdit };
