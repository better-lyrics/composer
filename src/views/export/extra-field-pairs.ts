import { RESERVED_META_KEYS } from "@/domain/project/metadata-ttml";
import { reconcileKeyedRows } from "@/views/export/reconcile-keyed-rows";
import { nanoid } from "nanoid";

// -- Interfaces ---------------------------------------------------------------

interface Pair {
  id: string;
  key: string;
  value: string;
}

// -- Reconciliation -----------------------------------------------------------

const seedPairs = (extra: Record<string, string>): Pair[] =>
  Object.entries(extra).map(([key, value]) => ({ id: nanoid(), key, value }));

const reconcilePairs = (previous: Pair[], extra: Record<string, string>): Pair[] =>
  reconcileKeyedRows(
    previous,
    Object.entries(extra),
    (row, [key, value]) => row.key === key && row.value === value,
    (id, [key, value]) => ({ id, key, value }),
  );

const sameRecord = (a: Record<string, string>, b: Record<string, string>): boolean => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};

const isReservedExtraKey = (key: string): boolean => RESERVED_META_KEYS.has(key.trim());

// `extra` is keyed by name, so two rows sharing a key can only ever store one
// value. The row that loses is reported rather than silently dropped.
const duplicateKeyIds = (pairs: Pair[]): ReadonlySet<string> => {
  const seen = new Map<string, string>();
  const duplicates = new Set<string>();
  for (const { id, key } of pairs) {
    const normalized = key.trim();
    if (normalized === "" || isReservedExtraKey(normalized)) continue;
    const firstId = seen.get(normalized);
    if (firstId === undefined) {
      seen.set(normalized, id);
      continue;
    }
    duplicates.add(id);
  }
  return duplicates;
};

const pairsToRecord = (pairs: Pair[]): Record<string, string> => {
  const record: Record<string, string> = {};
  const duplicates = duplicateKeyIds(pairs);
  for (const { id, key, value } of pairs) {
    const normalized = key.trim();
    if (normalized === "" || isReservedExtraKey(normalized) || duplicates.has(id)) continue;
    record[normalized] = value;
  }
  return record;
};

// -- Exports ------------------------------------------------------------------

export { seedPairs, reconcilePairs, sameRecord, pairsToRecord, isReservedExtraKey, duplicateKeyIds };
export type { Pair };
