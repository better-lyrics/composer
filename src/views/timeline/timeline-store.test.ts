import { beforeEach, describe, expect, it } from "vitest";
import { useTimelineStore } from "@/views/timeline/timeline-store";

describe("rollingEditMode", () => {
  it("defaults to off and toggles", () => {
    useTimelineStore.setState({ rollingEditMode: false });
    expect(useTimelineStore.getState().rollingEditMode).toBe(false);
    useTimelineStore.getState().toggleRollingEditMode();
    expect(useTimelineStore.getState().rollingEditMode).toBe(true);
  });
});

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
    store.setSelectedWords([{ lineId: "l1", lineIndex: 0, wordIndex: 0, type: "word" }]);
    store.setContextMenu({ x: 1, y: 2, target: { kind: "gutter", lineId: "l1", lineIndex: 0 } });
    store.setEditingWord({ lineId: "l1", wordIndex: 0, type: "word" });
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
      store.setSelectedWords([{ lineId: "l1", lineIndex: 0, wordIndex: 0, type: "word" }]);
      store.setContextMenu({ x: 1, y: 2, target: { kind: "gutter", lineId: "l1", lineIndex: 0 } });
      store.openGroup("g1", 0);

      expect(useTimelineStore.getState().selectedWords).toEqual([]);
      expect(useTimelineStore.getState().contextMenu).toBeNull();
    });

    it("closeGroup keeps the selection", () => {
      const store = useTimelineStore.getState();
      store.openGroup("g1", 0);
      store.setSelectedWords([{ lineId: "l1", lineIndex: 0, wordIndex: 0, type: "word" }]);
      store.closeGroup();

      expect(useTimelineStore.getState().selectedWords).toHaveLength(1);
    });
  });
});
