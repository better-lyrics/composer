// -- Types --------------------------------------------------------------------

interface TrackSelection {
  readonly lineId: string;
  readonly type: "word" | "bg";
  readonly wordIndex: number;
}

interface LineIndexes<T extends TrackSelection> {
  readonly mainIdxs: Set<number>;
  readonly bgIdxs: Set<number>;
  // The first selection on the line, in selection order.
  readonly first: T;
}

// -- Functions ----------------------------------------------------------------

// The selected main and background syllable indexes of each line, by line id, in the order lines are first selected.
function selectionIndexesByLine<T extends TrackSelection>(selections: Iterable<T>): Map<string, LineIndexes<T>> {
  const byLine = new Map<string, LineIndexes<T>>();
  for (const selection of selections) {
    let entry = byLine.get(selection.lineId);
    if (!entry) {
      entry = { mainIdxs: new Set(), bgIdxs: new Set(), first: selection };
      byLine.set(selection.lineId, entry);
    }
    if (selection.type === "word") entry.mainIdxs.add(selection.wordIndex);
    else entry.bgIdxs.add(selection.wordIndex);
  }
  return byLine;
}

// -- Exports ------------------------------------------------------------------

export { selectionIndexesByLine };
