import { useRef, useState } from "react";

// -- Interfaces ---------------------------------------------------------------

interface ReconciledBufferOps<Row, External> {
  seed: (external: External) => Row[];
  reconcile: (previous: Row[], external: External) => Row[];
  equal: (a: External, b: External) => boolean;
  emit: (rows: Row[]) => External;
}

interface ReconciledBuffer<Row> {
  rows: Row[];
  commit: (next: Row[]) => void;
}

// -- Hook ---------------------------------------------------------------------

/**
 * Keeps a local editing buffer (rows carrying stable ids) in sync with an
 * external store value. The buffer resets only when the external value changes
 * from outside (a project load, import, or other foreign write), never when it
 * echoes back a change this buffer just emitted. Edits stay in the buffer with
 * stable row identity, so inputs never lose focus.
 */
function useReconciledBuffer<Row, External>(
  external: External,
  onChange: (next: External) => void,
  ops: ReconciledBufferOps<Row, External>,
): ReconciledBuffer<Row> {
  const [rows, setRows] = useState<Row[]>(() => ops.seed(external));
  const lastExternal = useRef(external);

  if (lastExternal.current !== external && !ops.equal(lastExternal.current, external)) {
    lastExternal.current = external;
    setRows((previous) => ops.reconcile(previous, external));
  }

  const commit = (next: Row[]) => {
    const emitted = ops.emit(next);
    lastExternal.current = emitted;
    setRows(next);
    onChange(emitted);
  };

  return { rows, commit };
}

// -- Exports ------------------------------------------------------------------

export { useReconciledBuffer };
export type { ReconciledBufferOps };
