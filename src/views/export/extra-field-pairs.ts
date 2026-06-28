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
  Object.entries(extra).map(([key, value], index) =>
    previous[index]?.key === key && previous[index]?.value === value
      ? previous[index]
      : { id: previous[index]?.id ?? nanoid(), key, value },
  );

const sameRecord = (a: Record<string, string>, b: Record<string, string>): boolean => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};

const pairsToRecord = (pairs: Pair[]): Record<string, string> => {
  const record: Record<string, string> = {};
  for (const { key, value } of pairs) {
    if (key.trim() !== "") record[key] = value;
  }
  return record;
};

// -- Exports ------------------------------------------------------------------

export { seedPairs, reconcilePairs, sameRecord, pairsToRecord };
export type { Pair };
