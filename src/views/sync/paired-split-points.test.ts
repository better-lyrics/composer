import {
  type PairedSplitPoints,
  togglePrimarySplitPoint,
  toggleTransliterationSplitPoint,
} from "@/views/sync/paired-split-points";
import { describe, expect, it } from "vitest";

const emptyState = (): PairedSplitPoints => ({
  splitPoints: [],
  transliterationSplitPoints: [],
});

describe("paired split points", () => {
  it("infers transliteration boundaries when an original boundary changes", () => {
    const first = togglePrimarySplitPoint(emptyState(), 1, "가나", "gana");
    expect(first).toEqual({ splitPoints: [1], transliterationSplitPoints: [2] });

    const second = togglePrimarySplitPoint(first, 1, "가나", "gana");
    expect(second).toEqual(emptyState());
  });

  it("normalizes an inferred transliteration split to the visible space boundary", () => {
    const selected = togglePrimarySplitPoint(emptyState(), 1, "붙어있던", "but eoissdeon");

    expect(selected).toEqual({ splitPoints: [1], transliterationSplitPoints: [4] });
  });

  it("preserves manually selected transliteration boundaries when inference would collide", () => {
    const state: PairedSplitPoints = {
      splitPoints: [1],
      transliterationSplitPoints: [1, 2],
    };

    expect(togglePrimarySplitPoint(state, 2, "abcdefghij", "abc")).toEqual({
      splitPoints: [1, 2],
      transliterationSplitPoints: [1, 2],
    });
  });

  it("toggles transliteration boundaries independently", () => {
    const selected = toggleTransliterationSplitPoint(emptyState(), 3);
    expect(selected.transliterationSplitPoints).toEqual([3]);
    expect(toggleTransliterationSplitPoint(selected, 3)).toEqual(emptyState());
  });
});
