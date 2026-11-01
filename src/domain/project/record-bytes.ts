// -- Derivations --------------------------------------------------------------

function estimateRecordBytes(record: unknown): number {
  return JSON.stringify(record)?.length ?? 0;
}

// -- Exports ------------------------------------------------------------------

export { estimateRecordBytes };
