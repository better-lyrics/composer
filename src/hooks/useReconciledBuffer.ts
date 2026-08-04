import { useState } from "react";

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

// Reseeds on foreign writes only, never on the store echoing back our own commit.
function useReconciledBuffer<Row, External>(
  external: External,
  onChange: (next: External) => void,
  ops: ReconciledBufferOps<Row, External>,
): ReconciledBuffer<Row> {
  const [rows, setRows] = useState<Row[]>(() => ops.seed(external));
  const [lastExternal, setLastExternal] = useState(external);

  if (lastExternal !== external && !ops.equal(lastExternal, external)) {
    setLastExternal(external);
    setRows((previous) => ops.reconcile(previous, external));
  }

  const commit = (next: Row[]) => {
    const emitted = ops.emit(next);
    setLastExternal(emitted);
    setRows(next);
    onChange(emitted);
  };

  return { rows, commit };
}

// -- Exports ------------------------------------------------------------------

export { useReconciledBuffer };
