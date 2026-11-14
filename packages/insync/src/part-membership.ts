import type { Part } from "./part";

// -- Helpers ------------------------------------------------------------------

function sameIds(before: readonly string[], after: readonly string[]): boolean {
  return before.length === after.length && before.every((id, index) => id === after[index]);
}

function sameMembers(part: Part, lineIds: readonly string[]): boolean {
  return sameIds(part.lineIds, lineIds);
}

// The part of the nearest line on each side that existed before, for every position in `after`.
function nearestKeptParts(
  after: readonly string[],
  kept: ReadonlySet<string>,
  partOf: ReadonlyMap<string, number>,
  step: 1 | -1,
): (number | undefined)[] {
  const nearest: (number | undefined)[] = new Array(after.length);
  let current: number | undefined;
  const start = step === 1 ? 0 : after.length - 1;
  for (let index = start; index >= 0 && index < after.length; index += step) {
    nearest[index] = current;
    if (kept.has(after[index])) current = partOf.get(after[index]);
  }
  return nearest;
}

// -- Functions ----------------------------------------------------------------

// Lines that are gone leave their part; a new line joins a part only when the lines on both sides of it belong to
// that part; a part left without lines goes. Unchanged parts keep their identity.
function partsAfterLineChange(
  parts: readonly Part[],
  before: readonly string[],
  after: readonly string[],
): readonly Part[] {
  if (parts.length === 0 || sameIds(before, after)) return parts;
  const kept = new Set(before);
  const partOf = new Map<string, number>();
  parts.forEach((part, index) => {
    for (const id of part.lineIds) partOf.set(id, index);
  });
  const previous = nearestKeptParts(after, kept, partOf, 1);
  const next = nearestKeptParts(after, kept, partOf, -1);
  const members: string[][] = parts.map(() => []);
  after.forEach((id, index) => {
    const part = kept.has(id) ? partOf.get(id) : previous[index] === next[index] ? previous[index] : undefined;
    if (part !== undefined) members[part].push(id);
  });
  const result = parts.flatMap((part, index) => {
    if (members[index].length === 0) return [];
    return [sameMembers(part, members[index]) ? part : { ...part, lineIds: members[index] }];
  });
  return result.length === parts.length && result.every((part, index) => part === parts[index]) ? parts : result;
}

// -- Exports ------------------------------------------------------------------

export { partsAfterLineChange };
