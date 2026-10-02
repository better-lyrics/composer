import {
  EMPTY_SELECTION,
  type SelectionState,
  selectAllOf,
  toggleSelection,
  visibleSelection,
} from "@/views/library/selection";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

// -- Types --------------------------------------------------------------------

interface LibrarySelection {
  selectedIds: ReadonlySet<string>;
  toggle: (id: string, range: boolean) => void;
  selectAll: () => void;
  clear: () => void;
}

// -- Hook ---------------------------------------------------------------------

function useLibrarySelection(visibleIds: readonly string[]): LibrarySelection {
  const [state, setState] = useState<SelectionState>(EMPTY_SELECTION);
  const visibleRef = useRef(visibleIds);

  useLayoutEffect(() => {
    visibleRef.current = visibleIds;
  });

  const selectedIds = useMemo(() => visibleSelection(state, visibleIds), [state, visibleIds]);
  const toggle = useCallback(
    (id: string, range: boolean) => setState((current) => toggleSelection(current, id, range, visibleRef.current)),
    [],
  );
  const selectAll = useCallback(() => setState((current) => selectAllOf(current, visibleRef.current)), []);
  const clear = useCallback(() => setState(EMPTY_SELECTION), []);

  return { selectedIds, toggle, selectAll, clear };
}

// -- Exports ------------------------------------------------------------------

export { useLibrarySelection };
