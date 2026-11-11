import type { LyricLine } from "@/domain/line/model";
import type { WordSelection } from "@/domain/selection/model";
import { useProjectStore } from "@/stores/project";
import { type SelectionGrips, selectionGripEdges } from "@/views/timeline/stretch-grips";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useCallback, useRef } from "react";

// -- Types ---------------------------------------------------------------------

type TrackType = WordSelection["type"];

interface TrackSelection {
  hasSelection: boolean;
  selectedIndices: ReadonlySet<number>;
  leftGrip: number;
  rightGrip: number;
}

interface CachedTrackSelection {
  selections: WordSelection[];
  lineId: string;
  type: TrackType;
  value: TrackSelection;
}

interface CachedGrips {
  selections: WordSelection[];
  lines: LyricLine[];
  grips: SelectionGrips;
}

// -- Constants -----------------------------------------------------------------

const NO_INDICES: ReadonlySet<number> = new Set();
const NOTHING_SELECTED: TrackSelection = {
  hasSelection: false,
  selectedIndices: NO_INDICES,
  leftGrip: -1,
  rightGrip: -1,
};
const SELECTED_ELSEWHERE: TrackSelection = {
  hasSelection: true,
  selectedIndices: NO_INDICES,
  leftGrip: -1,
  rightGrip: -1,
};

// -- State ---------------------------------------------------------------------

let cachedGrips: CachedGrips | null = null;

// -- Helpers -------------------------------------------------------------------

// Every track touched by one selection change asks for the same grips, so they are resolved once and shared.
function sharedSelectionGrips(selections: WordSelection[]): SelectionGrips {
  const { lines } = useProjectStore.getState();
  if (cachedGrips && cachedGrips.selections === selections && cachedGrips.lines === lines) return cachedGrips.grips;
  const grips = selectionGripEdges(lines, selections);
  cachedGrips = { selections, lines, grips };
  return grips;
}

function trackSelectionOf(selections: WordSelection[], lineId: string, type: TrackType): TrackSelection {
  if (selections.length === 0) return NOTHING_SELECTED;
  let indices: Set<number> | null = null;
  for (const selection of selections) {
    if (selection.lineId !== lineId || selection.type !== type) continue;
    indices ??= new Set();
    indices.add(selection.wordIndex);
  }
  if (!indices) return SELECTED_ELSEWHERE;
  // Lines are read non-reactively: grips only follow selection changes, so a stretch drag keeps them in place.
  const { left, right } = sharedSelectionGrips(selections);
  return {
    hasSelection: true,
    selectedIndices: indices,
    leftGrip: left && left.lineId === lineId && left.type === type ? left.wordIndex : -1,
    rightGrip: right && right.lineId === lineId && right.type === type ? right.wordIndex : -1,
  };
}

function sameTrackSelection(a: TrackSelection, b: TrackSelection): boolean {
  if (a.hasSelection !== b.hasSelection || a.leftGrip !== b.leftGrip || a.rightGrip !== b.rightGrip) return false;
  if (a.selectedIndices.size !== b.selectedIndices.size) return false;
  for (const index of a.selectedIndices) if (!b.selectedIndices.has(index)) return false;
  return true;
}

function nextTrackSelection(
  selections: WordSelection[],
  lineId: string,
  type: TrackType,
  previous: TrackSelection | null,
): TrackSelection {
  const next = trackSelectionOf(selections, lineId, type);
  return previous && sameTrackSelection(previous, next) ? previous : next;
}

// -- Hook ----------------------------------------------------------------------

// Keeps its previous value while this track's part of the selection is unchanged, so selecting elsewhere never re-renders it.
function useTrackSelection(lineId: string, type: TrackType): TrackSelection {
  const cacheRef = useRef<CachedTrackSelection | null>(null);
  const select = useCallback(
    (state: { selectedWords: WordSelection[] }): TrackSelection => {
      const cached = cacheRef.current;
      const selections = state.selectedWords;
      if (cached && cached.selections === selections && cached.lineId === lineId && cached.type === type) {
        return cached.value;
      }
      const value = nextTrackSelection(selections, lineId, type, cached?.value ?? null);
      cacheRef.current = { selections, lineId, type, value };
      return value;
    },
    [lineId, type],
  );
  return useTimelineStore(select);
}

// -- Exports -------------------------------------------------------------------

export { nextTrackSelection, useTrackSelection };
