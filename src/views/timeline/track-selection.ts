import type { LyricLine } from "@/domain/line/model";
import type { SyllableAddress } from "@/domain/selection/model";
import { resolveAddresses } from "@/domain/selection/resolve";
import { useProjectStore } from "@/stores/project";
import { type SelectionGrips, selectionGripEdges } from "@/views/timeline/stretch-grips";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useCallback, useRef } from "react";

// -- Types ---------------------------------------------------------------------

type TrackType = SyllableAddress["type"];

interface TrackSelection {
  hasSelection: boolean;
  selectedIds: ReadonlySet<string>;
  leftGrip: string | null;
  rightGrip: string | null;
}

interface CachedTrackSelection {
  selections: SyllableAddress[];
  lineId: string;
  type: TrackType;
  value: TrackSelection;
}

interface CachedGrips {
  selections: SyllableAddress[];
  lines: LyricLine[];
  grips: SelectionGrips;
}

// -- Constants -----------------------------------------------------------------

const NO_IDS: ReadonlySet<string> = new Set();
const NOTHING_SELECTED: TrackSelection = {
  hasSelection: false,
  selectedIds: NO_IDS,
  leftGrip: null,
  rightGrip: null,
};
const SELECTED_ELSEWHERE: TrackSelection = {
  hasSelection: true,
  selectedIds: NO_IDS,
  leftGrip: null,
  rightGrip: null,
};

// -- State ---------------------------------------------------------------------

let cachedGrips: CachedGrips | null = null;

// -- Helpers -------------------------------------------------------------------

// Every track touched by one selection change asks for the same grips, so they are resolved once and shared.
function sharedSelectionGrips(selections: SyllableAddress[]): SelectionGrips {
  const { lines } = useProjectStore.getState();
  if (cachedGrips && cachedGrips.selections === selections && cachedGrips.lines === lines) return cachedGrips.grips;
  const grips = selectionGripEdges(lines, resolveAddresses(lines, selections));
  cachedGrips = { selections, lines, grips };
  return grips;
}

function trackSelectionOf(selections: SyllableAddress[], lineId: string, type: TrackType): TrackSelection {
  if (selections.length === 0) return NOTHING_SELECTED;
  let ids: Set<string> | null = null;
  for (const selection of selections) {
    if (selection.lineId !== lineId || selection.type !== type) continue;
    ids ??= new Set();
    ids.add(selection.syllableId);
  }
  if (!ids) return SELECTED_ELSEWHERE;
  // Lines are read non-reactively: grips only follow selection changes, so a stretch drag keeps them in place.
  const { left, right } = sharedSelectionGrips(selections);
  return {
    hasSelection: true,
    selectedIds: ids,
    leftGrip: left && left.lineId === lineId && left.type === type ? left.syllableId : null,
    rightGrip: right && right.lineId === lineId && right.type === type ? right.syllableId : null,
  };
}

function sameTrackSelection(a: TrackSelection, b: TrackSelection): boolean {
  if (a.hasSelection !== b.hasSelection || a.leftGrip !== b.leftGrip || a.rightGrip !== b.rightGrip) return false;
  if (a.selectedIds.size !== b.selectedIds.size) return false;
  for (const id of a.selectedIds) if (!b.selectedIds.has(id)) return false;
  return true;
}

function nextTrackSelection(
  selections: SyllableAddress[],
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
    (state: { selectedWords: SyllableAddress[] }): TrackSelection => {
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
