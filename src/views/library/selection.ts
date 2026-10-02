// -- Types --------------------------------------------------------------------

interface SelectionState {
  picked: ReadonlySet<string>;
  anchorId: string | null;
}

// -- Constants ----------------------------------------------------------------

const NOTHING_SELECTED: ReadonlySet<string> = new Set();
const EMPTY_SELECTION: SelectionState = { picked: NOTHING_SELECTED, anchorId: null };

// -- Transitions --------------------------------------------------------------

function toggleSelection(
  state: SelectionState,
  id: string,
  range: boolean,
  orderedIds: readonly string[],
): SelectionState {
  const picked = new Set(state.picked);
  const from = range && state.anchorId !== null ? orderedIds.indexOf(state.anchorId) : -1;
  const to = orderedIds.indexOf(id);
  if (from !== -1 && to !== -1) {
    for (const rangeId of orderedIds.slice(Math.min(from, to), Math.max(from, to) + 1)) picked.add(rangeId);
  } else if (picked.has(id)) {
    picked.delete(id);
  } else {
    picked.add(id);
  }
  return { picked, anchorId: id };
}

function selectAllOf(state: SelectionState, orderedIds: readonly string[]): SelectionState {
  return { picked: new Set(orderedIds), anchorId: state.anchorId };
}

// -- Derivations --------------------------------------------------------------

function visibleSelection(state: SelectionState, orderedIds: readonly string[]): ReadonlySet<string> {
  if (state.picked.size === 0) return NOTHING_SELECTED;
  const visible = orderedIds.filter((id) => state.picked.has(id));
  return visible.length === 0 ? NOTHING_SELECTED : new Set(visible);
}

// -- Exports ------------------------------------------------------------------

export { EMPTY_SELECTION, toggleSelection, selectAllOf, visibleSelection };
export type { SelectionState };
