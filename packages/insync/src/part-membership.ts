import type { Part } from "./part";

// -- Helpers ------------------------------------------------------------------

function sameIds(before: readonly string[], after: readonly string[]): boolean {
  return before.length === after.length && before.every((id, index) => id === after[index]);
}

function sameMembers(part: Part, lineIds: readonly string[]): boolean {
  return sameIds(part.lineIds, lineIds);
}

// Lines that kept their order: all lines still there when none moved, else a longest run by position before. Every
// other line in `after` is new or moved.
function linesInOrder(before: readonly string[], after: readonly string[]): Set<string> {
  const position = new Map(before.map((id, index) => [id, index]));
  const kept = after.filter((id) => position.has(id));
  if (kept.every((id, index) => index === 0 || (position.get(kept[index - 1]) ?? 0) < (position.get(id) ?? 0))) {
    return new Set(kept);
  }
  const tails: number[] = [];
  const tailAt: number[] = [];
  const previousOf: number[] = new Array(kept.length);
  kept.forEach((id, index) => {
    const at = position.get(id) ?? 0;
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (tails[middle] < at) low = middle + 1;
      else high = middle;
    }
    tails[low] = at;
    tailAt[low] = index;
    previousOf[index] = low > 0 ? tailAt[low - 1] : -1;
  });
  const inOrder = new Set<string>();
  for (let index = tails.length > 0 ? tailAt[tails.length - 1] : -1; index >= 0; index = previousOf[index]) {
    inOrder.add(kept[index]);
  }
  return inOrder;
}

// The part of the nearest line on each side that kept its order, for every position in `after`.
function nearestKeptParts(
  after: readonly string[],
  inOrder: ReadonlySet<string>,
  partOf: ReadonlyMap<string, number>,
  step: 1 | -1,
): (number | undefined)[] {
  const nearest: (number | undefined)[] = new Array(after.length);
  let current: number | undefined;
  const start = step === 1 ? 0 : after.length - 1;
  for (let index = start; index >= 0 && index < after.length; index += step) {
    nearest[index] = current;
    if (inOrder.has(after[index])) current = partOf.get(after[index]);
  }
  return nearest;
}

// A part none of whose lines kept their order moved as a whole: its longest run of lines that landed outside every
// other stretch stays the part.
function withMovedParts(
  after: readonly string[],
  assigned: readonly (number | undefined)[],
  partOf: ReadonlyMap<string, number>,
): (number | undefined)[] {
  const anchored = new Set(assigned.filter((part) => part !== undefined));
  const longest = new Map<number, { start: number; length: number }>();
  let index = 0;
  while (index < after.length) {
    const part = partOf.get(after[index]);
    let end = index;
    if (part !== undefined && !anchored.has(part) && assigned[index] === undefined) {
      while (end + 1 < after.length && assigned[end + 1] === undefined && partOf.get(after[end + 1]) === part) end++;
      const length = end - index + 1;
      if (length > (longest.get(part)?.length ?? 0)) longest.set(part, { start: index, length });
    }
    index = end + 1;
  }
  const result = [...assigned];
  for (const [part, { start, length }] of longest) result.fill(part, start, start + length);
  return result;
}

// -- Functions ----------------------------------------------------------------

// A part is one stretch of lines. Lines that are gone leave their part; a new or moved line joins the part whose
// stretch it lands inside, that is when the lines on both sides of it belong to that part; a part left without lines
// goes. Unchanged parts keep their identity.
function partsAfterLineChange(
  parts: readonly Part[],
  before: readonly string[],
  after: readonly string[],
): readonly Part[] {
  if (parts.length === 0 || sameIds(before, after)) return parts;
  const inOrder = linesInOrder(before, after);
  const partOf = new Map<string, number>();
  parts.forEach((part, index) => {
    for (const id of part.lineIds) partOf.set(id, index);
  });
  const previous = nearestKeptParts(after, inOrder, partOf, 1);
  const next = nearestKeptParts(after, inOrder, partOf, -1);
  const assigned = after.map((id, index) =>
    inOrder.has(id) ? partOf.get(id) : previous[index] === next[index] ? previous[index] : undefined,
  );
  const members: string[][] = parts.map(() => []);
  withMovedParts(after, assigned, partOf).forEach((part, index) => {
    if (part !== undefined) members[part].push(after[index]);
  });
  const result = parts.flatMap((part, index) => {
    if (members[index].length === 0) return [];
    return [sameMembers(part, members[index]) ? part : { ...part, lineIds: members[index] }];
  });
  return result.length === parts.length && result.every((part, index) => part === parts[index]) ? parts : result;
}

// -- Exports ------------------------------------------------------------------

export { partsAfterLineChange };
