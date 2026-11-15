import { describe, expect, it } from "vitest";
import { type LineageCounterpart, syllableLineage } from "@/domain/group/syllable-lineage";
import type { Syllable } from "insync/line";

const syllable = (id: string, text: string, begin?: number, end?: number): Syllable =>
  begin === undefined || end === undefined
    ? { id, text, sep: "", joinsNext: false }
    : { id, text, sep: "", joinsNext: false, begin, end };

const spans = (syllables: readonly Syllable[]) => syllables.map((s) => [s.text, s.begin, s.end]);

// The other instance holds the same syllables under its own ids, at its own times.
function counterpartIn(source: readonly Syllable[], target: readonly Syllable[]): LineageCounterpart {
  return (id) => {
    const position = source.findIndex((s) => s.id === id);
    return position === -1 ? undefined : { source: source[position], target: target[position] };
  };
}

describe("syllableLineage", () => {
  it("an own-timing instance divides its own span at the ratio of the edited split", () => {
    const before = [syllable("a", "drift", 1, 2), syllable("b", "lantern", 2, 3)];
    const after = [syllable("a", "drift", 1, 2), syllable("b", "lan", 2, 2.4), syllable("n", "tern", 2.4, 3)];
    const own = [syllable("x", "drift", 9, 10), syllable("y", "lantern", 10, 11)];
    const carried = syllableLineage(before, after, counterpartIn(before, own));
    expect(spans(carried)).toEqual([
      ["drift", 9, 10],
      ["lan", 10, 10.4],
      ["tern", 10.4, 11],
    ]);
    expect(carried.map((s) => s.id).slice(0, 2)).toEqual(["x", "y"]);
    expect(["x", "y", "n"]).not.toContain(carried[2].id);
  });

  it("a merge gives each instance the envelope of its parts", () => {
    const before = [syllable("a", "lan", 2, 2.4), syllable("b", "tern", 2.5, 3)];
    const after = [syllable("a", "lantern", 2, 3)];
    const own = [syllable("x", "lan", 10, 10.2), syllable("y", "tern", 10.6, 11.5)];
    expect(spans(syllableLineage(before, after, counterpartIn(before, own)))).toEqual([["lantern", 10, 11.5]]);
  });

  it("a syllable the edit added untimed stays untimed, and so does every one after it", () => {
    const before = [syllable("a", "glow", 1, 2), syllable("b", "on", 2, 3)];
    const after = [syllable("a", "glow", 1, 2), syllable("n", "and"), syllable("b", "on", 2, 3)];
    const own = [syllable("x", "glow", 5, 6), syllable("y", "on", 6, 7)];
    expect(spans(syllableLineage(before, after, counterpartIn(before, own)))).toEqual([
      ["glow", 5, 6],
      ["and", undefined, undefined],
      ["on", undefined, undefined],
    ]);
  });
});

describe("syllableLineage · syllables added at the end", () => {
  const before = [syllable("a", "glow", 1, 2), syllable("b", "on", 2, 3)];
  const after = [...before, syllable("n", "now", 3.25, 3.75)];

  it("regression: a timed syllable added at the end keeps its length, scaled to the instance", () => {
    const own = [syllable("x", "glow", 5, 7), syllable("y", "on", 7, 9)];
    expect(spans(syllableLineage(before, after, counterpartIn(before, own)))[2]).toEqual(["now", 9.5, 10.5]);
  });

  it("stops at the end the instance has room for", () => {
    const own = [syllable("x", "glow", 5, 7), syllable("y", "on", 7, 9)];
    expect(spans(syllableLineage(before, after, counterpartIn(before, own), { floor: 0, limit: 10 }))[2]).toEqual([
      "now",
      9.5,
      10,
    ]);
  });
});
