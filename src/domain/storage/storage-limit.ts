// -- Types --------------------------------------------------------------------

type StorageLimit = "1gb" | "2gb" | "5gb" | "none";

// -- Constants ----------------------------------------------------------------

const GIBIBYTE = 1024 ** 3;
const STORAGE_LIMITS: readonly StorageLimit[] = ["1gb", "2gb", "5gb", "none"];
const LIMIT_BYTES: Record<Exclude<StorageLimit, "none">, number> = {
  "1gb": GIBIBYTE,
  "2gb": 2 * GIBIBYTE,
  "5gb": 5 * GIBIBYTE,
};

// -- Rules --------------------------------------------------------------------

function isStorageLimit(value: unknown): value is StorageLimit {
  return typeof value === "string" && (STORAGE_LIMITS as readonly string[]).includes(value);
}

function storageLimitBytes(limit: StorageLimit): number | undefined {
  return limit === "none" ? undefined : LIMIT_BYTES[limit];
}

// -- Exports ------------------------------------------------------------------

export { isStorageLimit, storageLimitBytes };
export type { StorageLimit };
