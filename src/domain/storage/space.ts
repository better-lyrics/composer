// -- Types --------------------------------------------------------------------

interface StorageEstimateBytes {
  usage: number;
  quota: number;
}

interface CleanupTarget {
  usedBytes: number;
  limitBytes: number | undefined;
  estimate: StorageEstimateBytes | undefined;
  storageFull: boolean;
}

// -- Constants ----------------------------------------------------------------

const LOW_SPACE_BYTES = 512 * 1024 ** 2;

// -- Derivations --------------------------------------------------------------

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function freeBytes(estimate: StorageEstimateBytes): number {
  return Math.max(0, finiteOrZero(estimate.quota) - finiteOrZero(estimate.usage));
}

function bytesToFree(target: CleanupTarget): number {
  const overLimit = target.limitBytes === undefined ? 0 : target.usedBytes - target.limitBytes;
  const lowSpace = target.estimate && target.estimate.quota > 0 ? LOW_SPACE_BYTES - freeBytes(target.estimate) : 0;
  const afterQuotaError = target.storageFull ? LOW_SPACE_BYTES : 0;
  return Math.max(0, overLimit, lowSpace, afterQuotaError);
}

// -- Exports ------------------------------------------------------------------

export { LOW_SPACE_BYTES, freeBytes, bytesToFree };
export type { StorageEstimateBytes };
