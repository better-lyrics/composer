import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { wordAt } from "@/domain/selection/resolve";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { resetAllStores } from "@/test/stores";
import { followLyricLines } from "@/views/timeline/follow-lyric-lines";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { splitIdenticalSyllables } from "@/domain/commands/word-edits";

describe("markerMode", () => {
  beforeEach(() => {
    useTimelineStore.setState({ markerMode: false });
  });

  it("defaults to false", () => {
    expect(useTimelineStore.getState().markerMode).toBe(false);
  });

  it("toggleMarkerMode flips it", () => {
    useTimelineStore.getState().toggleMarkerMode();
    expect(useTimelineStore.getState().markerMode).toBe(true);
  });

  describe("invariants", () => {
    it("toggling twice returns to false", () => {
      const s = useTimelineStore.getState();
      s.toggleMarkerMode();
      s.toggleMarkerMode();
      expect(useTimelineStore.getState().markerMode).toBe(false);
    });
  });
});

describe("resetProjectScope", () => {
  it("clears the selection, menus, word editing, paste mode and scroll", () => {
    const store = useTimelineStore.getState();
    store.setSelectedWords([{ lineId: "l1", type: "word", syllableId: "w0" }]);
    store.setContextMenu({ x: 1, y: 2, target: { kind: "gutter", lineId: "l1", lineIndex: 0 } });
    store.setEditingWord({ lineId: "l1", type: "word", syllableId: "w0" });
    store.setScrollLeft(240);
    store.resetProjectScope();
    const state = useTimelineStore.getState();
    expect(state.selectedWords).toEqual([]);
    expect(state.contextMenu).toBeNull();
    expect(state.editingWord).toBeNull();
    expect(state.pasteMode).toEqual({ status: "idle" });
    expect(state.scrollLeft).toBe(0);
  });

  describe("invariants", () => {
    it("keeps view preferences such as zoom", () => {
      useTimelineStore.getState().setZoom(140);
      useTimelineStore.getState().resetProjectScope();
      expect(useTimelineStore.getState().zoom).toBe(140);
    });
  });
});

describe("group focus", () => {
  beforeEach(() => {
    useTimelineStore.setState({ focusedGroup: null, selectedWords: [], contextMenu: null });
  });

  it("starts with no group open", () => {
    expect(useTimelineStore.getState().focusedGroup).toBeNull();
  });

  it("openGroup hears the opened instance", () => {
    useTimelineStore.getState().openGroup("g1", 2);

    expect(useTimelineStore.getState().focusedGroup).toEqual({ groupId: "g1", hearInstanceIdx: 2 });
  });

  it("openGroup on the open group switches the heard instance", () => {
    const store = useTimelineStore.getState();
    store.openGroup("g1", 0);
    store.openGroup("g1", 1);

    expect(useTimelineStore.getState().focusedGroup).toEqual({ groupId: "g1", hearInstanceIdx: 1 });
  });

  it("closeGroup returns to the song", () => {
    const store = useTimelineStore.getState();
    store.openGroup("g1", 0);
    store.closeGroup();

    expect(useTimelineStore.getState().focusedGroup).toBeNull();
  });

  it("resetProjectScope closes the group", () => {
    const store = useTimelineStore.getState();
    store.openGroup("g1", 0);
    store.resetProjectScope();

    expect(useTimelineStore.getState().focusedGroup).toBeNull();
  });

  describe("invariants", () => {
    it("openGroup clears the selection and the menu so hidden words are never acted on", () => {
      const store = useTimelineStore.getState();
      store.setSelectedWords([{ lineId: "l1", type: "word", syllableId: "w0" }]);
      store.setContextMenu({ x: 1, y: 2, target: { kind: "gutter", lineId: "l1", lineIndex: 0 } });
      store.openGroup("g1", 0);

      expect(useTimelineStore.getState().selectedWords).toEqual([]);
      expect(useTimelineStore.getState().contextMenu).toBeNull();
    });

    it("closeGroup keeps the selection", () => {
      const store = useTimelineStore.getState();
      store.openGroup("g1", 0);
      store.setSelectedWords([{ lineId: "l1", type: "word", syllableId: "w0" }]);
      store.closeGroup();

      expect(useTimelineStore.getState().selectedWords).toHaveLength(1);
    });
  });
});

describe("loopRegion", () => {
  const word = { lineId: "a", type: "word" as const, syllableId: "w0" };
  const region = { begin: 1, end: 2, loops: true };

  beforeEach(() => {
    useTimelineStore.setState({ loopRegion: null, selectedWords: [] });
  });

  it("drawing a region clears the word selection", () => {
    useTimelineStore.getState().setSelectedWords([word]);
    useTimelineStore.getState().setLoopRegion(region);
    expect(useTimelineStore.getState().selectedWords).toEqual([]);
    expect(useTimelineStore.getState().loopRegion).toEqual(region);
  });

  it("selecting words clears the region", () => {
    useTimelineStore.getState().setLoopRegion(region);
    useTimelineStore.getState().setSelectedWords([word]);
    expect(useTimelineStore.getState().loopRegion).toBeNull();
  });

  it("toggling a word into the selection clears the region", () => {
    useTimelineStore.getState().setLoopRegion(region);
    useTimelineStore.getState().toggleSelection(word);
    expect(useTimelineStore.getState().loopRegion).toBeNull();
  });

  it("an empty selection keeps the region", () => {
    useTimelineStore.getState().setLoopRegion(region);
    useTimelineStore.getState().setSelectedWords([]);
    expect(useTimelineStore.getState().loopRegion).toEqual(region);
  });

  it("clearing an already empty selection keeps the same array", () => {
    const empty = useTimelineStore.getState().selectedWords;
    useTimelineStore.getState().setSelectedWords([]);
    useTimelineStore.getState().clearSelection();
    expect(useTimelineStore.getState().selectedWords).toBe(empty);
  });

  it("is project scoped", () => {
    useTimelineStore.getState().setLoopRegion(region);
    useTimelineStore.getState().setLoopRegionDrag({ edge: "end", snappedTo: null, draft: null });
    useTimelineStore.getState().resetProjectScope();
    expect(useTimelineStore.getState().loopRegion).toBeNull();
    expect(useTimelineStore.getState().loopRegionDrag).toBeNull();
  });
});

describe("selection after a lines change", () => {
  const line = createLine({
    id: "a",
    text: "Fall in to place",
    words: [
      { id: "w1", text: "Fall", sep: " ", begin: 1, end: 2 },
      { id: "w2", text: "in", sep: " ", begin: 2, end: 2.5 },
      { id: "w3", text: "to", sep: " ", begin: 2.5, end: 3 },
      { id: "w4", text: "place", begin: 3, end: 4 },
    ],
  });
  const address = (syllableId: string) => ({ lineId: "a", type: "word" as const, syllableId });
  let stopFollowing = () => {};

  function selectedTexts(): (string | undefined)[] {
    const { lines } = useProjectStore.getState();
    return useTimelineStore.getState().selectedWords.map((selected) => wordAt(lines, selected)?.text);
  }

  function splitFirstWord(): void {
    useProjectStore.getState().commit(
      splitIdenticalSyllables({
        source: { lineId: "a", wordIndex: 0, type: "word" },
        splitPoints: [2],
        caseInsensitive: false,
      }),
    );
  }

  beforeEach(async () => {
    await resetAllStores();
    useProjectStore.getState().restoreLyrics({ lines: [line] });
    stopFollowing = followLyricLines();
  });

  afterEach(() => stopFollowing());

  it("regression: a split before a selected word keeps the selection on that word", () => {
    useTimelineStore.getState().setSelectedWords([address("w2")]);
    splitFirstWord();
    expect(useProjectStore.getState().lines[0].words?.map((word) => word.text)).toEqual([
      "Fa",
      "ll",
      "in",
      "to",
      "place",
    ]);
    expect(selectedTexts()).toEqual(["in"]);
  });

  it("drops a selected word that undo removed and keeps the rest, the same array when nothing drops", () => {
    splitFirstWord();
    const piece = useProjectStore.getState().lines[0].words?.[1];
    useTimelineStore.getState().setSelectedWords([address("w1"), address(piece?.id ?? ""), address("w3")]);
    useTimelineStore.getState().setEditingWord(address(piece?.id ?? ""));
    useProjectStore.getState().undo();
    expect(selectedTexts()).toEqual(["Fall", "to"]);
    expect(useTimelineStore.getState().editingWord).toBeNull();

    const kept = useTimelineStore.getState().selectedWords;
    useProjectStore.getState().redo();
    expect(useTimelineStore.getState().selectedWords).toBe(kept);
  });

  it("a restore drops every address whose word the restored lyrics do not have", () => {
    useTimelineStore.getState().setSelectedWords([address("w1"), address("w3")]);
    useTimelineStore.getState().setEditingWord(address("w3"));
    useProjectStore.getState().restoreLyrics({ lines: [createLine({ id: "a", text: "Rise up" })] });
    expect(useTimelineStore.getState().selectedWords).toEqual([]);
    expect(useTimelineStore.getState().editingWord).toBeNull();
  });

  it("regression: a Step cursor that undo removed moves to the first queued word left", () => {
    splitFirstWord();
    const piece = useProjectStore.getState().lines[0].words?.[1];
    useTimelineStore.getState().setStepTiming(true);
    useTimelineStore.getState().setSelectedWords([address(piece?.id ?? ""), address("w3"), address("w4")], true);
    useProjectStore.getState().undo();
    expect(selectedTexts()).toEqual(["to"]);
    expect(useTimelineStore.getState().stepQueue).toEqual([address("w3"), address("w4")]);
  });

  it("regression: a word dragged between two queued words takes its new place in the Step queue", () => {
    useTimelineStore.getState().setStepTiming(true);
    useTimelineStore.getState().setSelectedWords([address("w1"), address("w2"), address("w3")], true);
    const [fall, into, to, place] = line.words ?? [];
    const reordered = [fall, { ...to, begin: 1.5 }, into, place];
    useProjectStore.getState().restoreLyrics({ lines: [createLine({ id: "a", text: line.text, words: reordered })] });
    expect(useTimelineStore.getState().stepQueue).toEqual([address("w1"), address("w3"), address("w2")]);
    expect(selectedTexts()).toEqual(["Fall"]);
  });
});
