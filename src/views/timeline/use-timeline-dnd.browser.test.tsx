import { computeSyllableGroups } from "@/domain/word/syllable-groups";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useTimelineDnd } from "@/views/timeline/use-timeline-dnd";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { toast } from "sonner";

// Row 0 main track sits at y ~100 with default row height 44 and waveform 81.
// Picking 100 lands inside the main half; 130 lands inside the bg drop zone.
const POINTER_Y_MAIN = 100;
const POINTER_Y_BG = 130;

function installScrollHost(): HTMLDivElement {
  const host = document.createElement("div");
  host.setAttribute("data-scroll-container", "");
  Object.defineProperty(host, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      top: 0,
      left: 0,
      right: 1000,
      bottom: 1000,
      width: 1000,
      height: 1000,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
  Object.defineProperty(host, "scrollLeft", { configurable: true, value: 0, writable: true });
  Object.defineProperty(host, "scrollTop", { configurable: true, value: 0, writable: true });
  document.body.appendChild(host);
  return host;
}

function makeDragStartEvent(shiftKey: boolean): DragStartEvent {
  return {
    active: {
      id: "w",
      data: {
        current: {
          lineId: "l1",
          lineIndex: 0,
          wordIndex: 1,
          trackType: "word",
          text: "er",
          begin: 0.3,
          end: 0.6,
        },
      },
      rect: { current: { initial: null, translated: null } },
    },
    activatorEvent: new PointerEvent("pointerdown", { shiftKey }),
  } as unknown as DragStartEvent;
}

interface DragEndOptions {
  overId: string;
  deltaY: number;
  activatorShift: boolean;
  deltaX?: number;
  pointerY?: number;
  pointerX?: number;
}

function makeDragEndEvent({
  overId,
  deltaY,
  activatorShift,
  deltaX = 5,
  pointerY = POINTER_Y_MAIN,
  pointerX = 200,
}: DragEndOptions): DragEndEvent {
  return {
    active: {
      id: "w",
      data: {
        current: {
          lineId: "l1",
          lineIndex: 0,
          wordIndex: 1,
          trackType: "word",
          text: "er",
          begin: 0.3,
          end: 0.6,
        },
      },
      rect: { current: { initial: null, translated: null } },
    },
    over: {
      id: overId,
      data: { current: { lineId: "l1" } },
      rect: { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 },
      disabled: false,
    },
    delta: { x: deltaX, y: deltaY },
    activatorEvent: new PointerEvent("pointerdown", { shiftKey: activatorShift, clientX: pointerX, clientY: pointerY }),
    collisions: null,
  } as unknown as DragEndEvent;
}

describe("useTimelineDnd · live shift state", () => {
  let scrollHost: HTMLDivElement;

  beforeEach(() => {
    useAudioStore.setState({ duration: 30 });
    useTimelineStore.setState({ rowHeights: {}, defaultRowHeight: 44, collapsedInstances: {} });
    useProjectStore.setState({
      lines: [
        {
          id: "l1",
          text: "every",
          agentId: "v1",
          words: [
            { text: "ev", begin: 0, end: 0.3, syllableGroupId: "g" },
            { text: "er", begin: 0.3, end: 0.6, syllableGroupId: "g" },
            { text: "y ", begin: 0.6, end: 0.9, syllableGroupId: "g" },
          ],
        },
      ],
    });
    scrollHost = installScrollHost();
  });

  afterEach(() => {
    scrollHost.remove();
  });

  it("moves the whole group across tracks when shift is pressed mid-drag, even though pointerdown had no shift", async () => {
    const lines = useProjectStore.getState().lines;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    result.current.handleDragStart(makeDragStartEvent(false));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", shiftKey: true, bubbles: true }));
    result.current.handleDragEnd(
      makeDragEndEvent({ overId: "bg-drop-l1", deltaY: 0, activatorShift: false, pointerY: POINTER_Y_BG }),
    );

    const after = useProjectStore.getState().lines[0];
    expect(after.words?.length ?? 0).toBe(0);
    expect(after.backgroundWords?.length).toBe(3);
    const sharedId = after.backgroundWords?.[0].syllableGroupId;
    expect(sharedId).toBeDefined();
    expect(after.backgroundWords?.[1].syllableGroupId).toBe(sharedId);
    expect(after.backgroundWords?.[2].syllableGroupId).toBe(sharedId);
  });

  it("shifts every groupmate by the same delta when a non-leading syllable is shift-dragged", async () => {
    useTimelineStore.setState({ zoom: 100 });
    const zoom = useTimelineStore.getState().zoom;
    const lines = useProjectStore.getState().lines;
    const before = lines[0].words ?? [];
    const { result } = await renderHook(() => useTimelineDnd(lines));

    result.current.handleDragStart(makeDragStartEvent(true));

    const deltaX = 60;
    result.current.handleDragEnd(
      makeDragEndEvent({
        overId: "main-drop-l1",
        deltaY: 0,
        activatorShift: true,
        deltaX,
        pointerY: POINTER_Y_MAIN,
      }),
    );

    const after = useProjectStore.getState().lines[0];
    const words = after.words ?? [];
    expect(words.length).toBe(3);

    const expectedShift = deltaX / zoom;
    expect(expectedShift).toBeGreaterThan(0.1);
    expect(words[0].begin).toBeCloseTo(before[0].begin + expectedShift, 4);
    expect(words[1].begin).toBeCloseTo(before[1].begin + expectedShift, 4);
    expect(words[2].begin).toBeCloseTo(before[2].begin + expectedShift, 4);

    for (let i = 1; i < words.length; i++) {
      expect(words[i].begin).toBeCloseTo(words[i - 1].end, 5);
    }
    const sharedId = words[0].syllableGroupId;
    expect(sharedId).toBeDefined();
    expect(words[1].syllableGroupId).toBe(sharedId);
    expect(words[2].syllableGroupId).toBe(sharedId);
  });

  it("moves the whole group when shift is released mid-drag, even though pointerdown had shift", async () => {
    const lines = useProjectStore.getState().lines;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    result.current.handleDragStart(makeDragStartEvent(true));
    document.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift", shiftKey: false, bubbles: true }));
    result.current.handleDragEnd(
      makeDragEndEvent({ overId: "bg-drop-l1", deltaY: 0, activatorShift: true, pointerY: POINTER_Y_BG }),
    );

    const after = useProjectStore.getState().lines[0];
    expect(after.words?.length ?? 0).toBe(0);
    expect(after.backgroundWords?.length).toBe(3);
    const sharedId = after.backgroundWords?.[0].syllableGroupId;
    expect(sharedId).toBeDefined();
    expect(after.backgroundWords?.[1].syllableGroupId).toBe(sharedId);
    expect(after.backgroundWords?.[2].syllableGroupId).toBe(sharedId);
  });
});

// -- Alt-drag duplicate -------------------------------------------------------

function makeAltDuplicateEvent(wordIndex: number, deltaX: number): DragEndEvent {
  return {
    active: {
      id: "w",
      data: {
        current: { lineId: "l1", lineIndex: 0, wordIndex, trackType: "word", text: "", begin: 0, end: 0 },
      },
      rect: { current: { initial: null, translated: null } },
    },
    delta: { x: deltaX, y: 0 },
    activatorEvent: new PointerEvent("pointerdown", { altKey: true }),
    collisions: null,
  } as unknown as DragEndEvent;
}

describe("useTimelineDnd · alt-drag duplicate", () => {
  beforeEach(() => {
    useAudioStore.setState({ duration: 30 });
    useTimelineStore.setState({ zoom: 100 });
    useProjectStore.setState({
      lines: [
        {
          id: "l1",
          text: "Hello world",
          agentId: "v1",
          words: [
            { text: "Hello ", begin: 0, end: 0.5 },
            { text: "world", begin: 2, end: 2.5 },
          ],
        },
      ],
    });
  });

  it("keeps a word boundary when a duplicated last word lands before the original", async () => {
    const lines = useProjectStore.getState().lines;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    result.current.handleDragEnd(makeAltDuplicateEvent(1, -100));

    const words = useProjectStore.getState().lines[0].words ?? [];
    expect(words.map((w) => w.text)).toEqual(["Hello ", "world ", "world"]);
    const groups = computeSyllableGroups(words);
    expect(groups.some((g) => g.startIndex <= 1 && g.endIndex >= 2)).toBe(false);
  });
});

// -- Within-track reorder seam ------------------------------------------------

function makeReorderDragStartEvent(): DragStartEvent {
  return {
    active: {
      id: "w",
      data: {
        current: {
          lineId: "l1",
          lineIndex: 0,
          wordIndex: 2,
          trackType: "word",
          text: "word3",
          begin: 2,
          end: 2.5,
        },
      },
      rect: { current: { initial: null, translated: null } },
    },
    activatorEvent: new PointerEvent("pointerdown", { shiftKey: false }),
  } as unknown as DragStartEvent;
}

function makeReorderDragEndEvent(): DragEndEvent {
  return {
    active: {
      id: "w",
      data: {
        current: {
          lineId: "l1",
          lineIndex: 0,
          wordIndex: 2,
          trackType: "word",
          text: "word3",
          begin: 2,
          end: 2.5,
        },
      },
      rect: { current: { initial: null, translated: null } },
    },
    over: {
      id: "main-drop-l1",
      data: { current: { lineId: "l1" } },
      rect: { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 },
      disabled: false,
    },
    delta: { x: -150, y: 0 },
    activatorEvent: new PointerEvent("pointerdown", { shiftKey: false, clientX: 400, clientY: POINTER_Y_MAIN }),
    collisions: null,
  } as unknown as DragEndEvent;
}

describe("useTimelineDnd · within-track reorder seam", () => {
  let scrollHost: HTMLDivElement;

  beforeEach(() => {
    useAudioStore.setState({ duration: 30 });
    useTimelineStore.setState({ zoom: 100, rowHeights: {}, defaultRowHeight: 44, collapsedInstances: {} });
    useProjectStore.setState({
      lines: [
        {
          id: "l1",
          text: "word1 word2 word3",
          agentId: "v1",
          words: [
            { text: "word1 ", begin: 0, end: 0.5 },
            { text: "word2 ", begin: 1, end: 1.5 },
            { text: "word3", begin: 2, end: 2.5 },
          ],
        },
      ],
    });
    scrollHost = installScrollHost();
  });

  afterEach(() => {
    scrollHost.remove();
  });

  it("keeps the dragged last word separate when it crosses a neighbor", async () => {
    const lines = useProjectStore.getState().lines;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    result.current.handleDragStart(makeReorderDragStartEvent());
    result.current.handleDragEnd(makeReorderDragEndEvent());

    const words = useProjectStore.getState().lines[0].words ?? [];
    expect(words.length).toBe(3);

    expect(computeSyllableGroups(words)).toEqual([]);

    const word3 = words.find((w) => w.text.trim() === "word3");
    expect(word3?.text).toBe("word3 ");
    expect(words[words.length - 1].text.endsWith(" ")).toBe(false);

    expect(words.map((w) => w.text.trim())).toEqual(["word1", "word3", "word2"]);
  });
});

// -- Background-word drag provenance ------------------------------------------

function makeBgReorderDragEndEvent(deltaX: number): DragEndEvent {
  return {
    active: {
      id: "bg",
      data: {
        current: {
          lineId: "l1",
          lineIndex: 0,
          wordIndex: 1,
          trackType: "bg",
          text: "aah",
          begin: 1,
          end: 1.5,
        },
      },
      rect: { current: { initial: null, translated: null } },
    },
    over: {
      id: "bg-drop-l1",
      data: { current: { lineId: "l1" } },
      rect: { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 },
      disabled: false,
    },
    delta: { x: deltaX, y: 0 },
    activatorEvent: new PointerEvent("pointerdown", { shiftKey: false, clientX: 300, clientY: 140 }),
    collisions: null,
  } as unknown as DragEndEvent;
}

describe("useTimelineDnd · background-word drag provenance", () => {
  let scrollHost: HTMLDivElement;

  beforeEach(() => {
    useAudioStore.setState({ duration: 30 });
    useTimelineStore.setState({ zoom: 100, rowHeights: {}, defaultRowHeight: 44, collapsedInstances: {} });
    useProjectStore.setState({
      lines: [
        {
          id: "l1",
          text: "main",
          agentId: "v1",
          words: [{ text: "main", begin: 0, end: 0.5 }],
          backgroundText: "ooh aah",
          backgroundWords: [
            { text: "ooh ", begin: 0, end: 0.5 },
            { text: "aah", begin: 1, end: 1.5 },
          ],
          backgroundTextSource: "extraction",
        },
      ],
    });
    scrollHost = installScrollHost();
  });

  afterEach(() => {
    scrollHost.remove();
  });

  it("flips an extraction-sourced background to manual after a bg word is dragged", async () => {
    const lines = useProjectStore.getState().lines;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    result.current.handleDragEnd(makeBgReorderDragEndEvent(-80));

    const after = useProjectStore.getState().lines[0];
    expect(after.backgroundTextSource).toBe("manual");
    expect(after.backgroundWords?.length).toBe(2);
  });

  it("preserves the dragged background word texts and count", async () => {
    const lines = useProjectStore.getState().lines;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    result.current.handleDragEnd(makeBgReorderDragEndEvent(-80));

    const bg = useProjectStore.getState().lines[0].backgroundWords ?? [];
    expect(bg).toHaveLength(2);
    expect(bg.map((w) => w.text.trim()).toSorted()).toEqual(["aah", "ooh"]);
  });
});

// -- Cross-line and reliable track switch -------------------------------------

interface CursorTargetingOptions {
  lineId: string;
  lineIndex: number;
  wordIndex: number;
  trackType: "word" | "bg";
  text: string;
  begin: number;
  end: number;
  pointerX: number;
  pointerY: number;
  deltaX: number;
  deltaY: number;
}

function makeCursorTargetingEvent({
  lineId,
  lineIndex,
  wordIndex,
  trackType,
  text,
  begin,
  end,
  pointerX,
  pointerY,
  deltaX,
  deltaY,
}: CursorTargetingOptions): DragEndEvent {
  return {
    active: {
      id: "w",
      data: {
        current: { lineId, lineIndex, wordIndex, trackType, text, begin, end },
      },
      rect: { current: { initial: null, translated: null } },
    },
    over: {
      id: `main-drop-${lineId}`,
      data: { current: { lineId } },
      rect: { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 },
      disabled: false,
    },
    delta: { x: deltaX, y: deltaY },
    activatorEvent: new PointerEvent("pointerdown", { clientX: pointerX, clientY: pointerY }),
    collisions: null,
  } as unknown as DragEndEvent;
}

describe("useTimelineDnd · cross-line and reliable track switch", () => {
  let scrollHost: HTMLDivElement;

  beforeEach(() => {
    useAudioStore.setState({ duration: 30 });
    useTimelineStore.setState({ zoom: 100, rowHeights: {}, defaultRowHeight: 44, collapsedInstances: {} });
    scrollHost = installScrollHost();
  });

  afterEach(() => {
    scrollHost.remove();
  });

  it("drops a main word into the same line's empty bg zone reliably even when cursor x stays put", async () => {
    useProjectStore.setState({
      lines: [
        {
          id: "l1",
          text: "hello world",
          agentId: "v1",
          words: [
            { text: "hello ", begin: 0.1, end: 0.5 },
            { text: "world", begin: 0.5, end: 0.9 },
          ],
        },
      ],
    });
    const lines = useProjectStore.getState().lines;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    result.current.handleDragEnd(
      makeCursorTargetingEvent({
        lineId: "l1",
        lineIndex: 0,
        wordIndex: 1,
        trackType: "word",
        text: "world",
        begin: 0.5,
        end: 0.9,
        pointerX: 100,
        pointerY: 100,
        deltaX: 0,
        deltaY: 30,
      }),
    );

    const after = useProjectStore.getState().lines[0];
    expect(after.words?.length).toBe(1);
    expect(after.backgroundWords?.length).toBe(1);
    expect(after.backgroundWords?.[0].text.trim()).toBe("world");
  });

  it("drops a bg word back into the same line's main zone reliably", async () => {
    useProjectStore.setState({
      lines: [
        {
          id: "l1",
          text: "hello",
          agentId: "v1",
          words: [{ text: "hello", begin: 0.1, end: 0.4 }],
          backgroundText: "ooh aah",
          backgroundWords: [
            { text: "ooh ", begin: 1.0, end: 1.4 },
            { text: "aah", begin: 1.5, end: 1.9 },
          ],
          backgroundTextSource: "manual",
        },
      ],
    });
    const lines = useProjectStore.getState().lines;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    result.current.handleDragEnd(
      makeCursorTargetingEvent({
        lineId: "l1",
        lineIndex: 0,
        wordIndex: 1,
        trackType: "bg",
        text: "aah",
        begin: 1.5,
        end: 1.9,
        pointerX: 200,
        pointerY: 150,
        deltaX: 0,
        deltaY: -50,
      }),
    );

    const after = useProjectStore.getState().lines[0];
    expect(after.words?.length).toBe(2);
    expect(after.backgroundWords?.length).toBe(1);
    expect(after.words?.some((w) => w.text.trim() === "aah")).toBe(true);
  });

  it("drops a main word from line A into line B's main track", async () => {
    useProjectStore.setState({
      lines: [
        {
          id: "lA",
          text: "alpha beta",
          agentId: "v1",
          words: [
            { text: "alpha ", begin: 0.1, end: 0.4 },
            { text: "beta", begin: 0.4, end: 0.7 },
          ],
        },
        {
          id: "lB",
          text: "delta",
          agentId: "v1",
          words: [{ text: "delta", begin: 5.0, end: 5.4 }],
        },
      ],
    });
    const lines = useProjectStore.getState().lines;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    result.current.handleDragEnd(
      makeCursorTargetingEvent({
        lineId: "lA",
        lineIndex: 0,
        wordIndex: 0,
        trackType: "word",
        text: "alpha",
        begin: 0.1,
        end: 0.4,
        pointerX: 200,
        pointerY: 100,
        deltaX: 600,
        deltaY: 60,
      }),
    );

    const after = useProjectStore.getState().lines;
    const a = after.find((l) => l.id === "lA");
    const b = after.find((l) => l.id === "lB");
    expect(a?.words?.length).toBe(1);
    expect(b?.words?.some((w) => w.text.trim() === "alpha")).toBe(true);
  });

  it("drops a main word from line A into line B's bg track", async () => {
    useProjectStore.setState({
      lines: [
        {
          id: "lA",
          text: "alpha beta",
          agentId: "v1",
          words: [
            { text: "alpha ", begin: 0.1, end: 0.4 },
            { text: "beta", begin: 0.4, end: 0.7 },
          ],
        },
        {
          id: "lB",
          text: "delta",
          agentId: "v1",
          words: [{ text: "delta", begin: 5.0, end: 5.4 }],
        },
      ],
    });
    const lines = useProjectStore.getState().lines;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    result.current.handleDragEnd(
      makeCursorTargetingEvent({
        lineId: "lA",
        lineIndex: 0,
        wordIndex: 0,
        trackType: "word",
        text: "alpha",
        begin: 0.1,
        end: 0.4,
        pointerX: 200,
        pointerY: 100,
        deltaX: 1000,
        deltaY: 110,
      }),
    );

    const after = useProjectStore.getState().lines;
    const a = after.find((l) => l.id === "lA");
    const b = after.find((l) => l.id === "lB");
    expect(a?.words?.length).toBe(1);
    expect(b?.backgroundWords?.some((w) => w.text.trim() === "alpha")).toBe(true);
  });

  it("rejects with a toast on cross-instance attempts and leaves both lines untouched", async () => {
    useProjectStore.setState({
      lines: [
        {
          id: "lA",
          text: "alpha beta",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          words: [
            { text: "alpha ", begin: 0.1, end: 0.4 },
            { text: "beta", begin: 0.4, end: 0.7 },
          ],
        },
        {
          id: "lB",
          text: "delta",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          words: [{ text: "delta", begin: 5.0, end: 5.4 }],
        },
      ],
    });
    const lines = useProjectStore.getState().lines;
    const before = lines.map((l) => l.words?.map((w) => w.text).join("|"));
    const baseline = toast.getHistory().length;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    result.current.handleDragEnd(
      makeCursorTargetingEvent({
        lineId: "lA",
        lineIndex: 0,
        wordIndex: 0,
        trackType: "word",
        text: "alpha",
        begin: 0.1,
        end: 0.4,
        pointerX: 200,
        pointerY: 240,
        deltaX: 600,
        deltaY: 0,
      }),
    );

    const after = useProjectStore.getState().lines.map((l) => l.words?.map((w) => w.text).join("|"));
    expect(after).toEqual(before);
    const fired = toast.getHistory().slice(baseline);
    expect(fired.some((t) => "title" in t && /Detach the line first/.test(String(t.title)))).toBe(true);
  });

  it("rejects with a toast when target line is line-synced and leaves data untouched", async () => {
    useProjectStore.setState({
      lines: [
        {
          id: "lA",
          text: "alpha beta",
          agentId: "v1",
          words: [
            { text: "alpha ", begin: 0.1, end: 0.4 },
            { text: "beta", begin: 0.4, end: 0.7 },
          ],
        },
        {
          id: "lB",
          text: "delta",
          agentId: "v1",
          begin: 5.0,
          end: 5.4,
        },
      ],
    });
    const lines = useProjectStore.getState().lines;
    const baseline = toast.getHistory().length;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    result.current.handleDragEnd(
      makeCursorTargetingEvent({
        lineId: "lA",
        lineIndex: 0,
        wordIndex: 0,
        trackType: "word",
        text: "alpha",
        begin: 0.1,
        end: 0.4,
        pointerX: 200,
        pointerY: 100,
        deltaX: 600,
        deltaY: 60,
      }),
    );

    const after = useProjectStore.getState().lines;
    expect(after.find((l) => l.id === "lA")?.words?.length).toBe(2);
    expect(after.find((l) => l.id === "lB")?.words).toBeUndefined();
    const fired = toast.getHistory().slice(baseline);
    expect(fired.some((t) => "title" in t && /Sync this line into words first/.test(String(t.title)))).toBe(true);
  });

  it("silently rejects an overlap and leaves both lines untouched", async () => {
    useProjectStore.setState({
      lines: [
        {
          id: "lA",
          text: "alpha beta",
          agentId: "v1",
          words: [
            { text: "alpha ", begin: 0.1, end: 0.4 },
            { text: "beta", begin: 0.4, end: 0.7 },
          ],
        },
        {
          id: "lB",
          text: "delta",
          agentId: "v1",
          words: [{ text: "delta", begin: 6.0, end: 6.6 }],
        },
      ],
    });
    const lines = useProjectStore.getState().lines;
    const before = JSON.stringify(lines);
    const baseline = toast.getHistory().length;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    result.current.handleDragEnd(
      makeCursorTargetingEvent({
        lineId: "lA",
        lineIndex: 0,
        wordIndex: 0,
        trackType: "word",
        text: "alpha",
        begin: 0.1,
        end: 0.4,
        pointerX: 200,
        pointerY: 160,
        deltaX: 595,
        deltaY: 0,
      }),
    );

    const after = JSON.stringify(useProjectStore.getState().lines);
    expect(after).toEqual(before);
    expect(toast.getHistory().length).toBe(baseline);
  });

  it("no-ops when cursor falls outside any row on drop", async () => {
    useProjectStore.setState({
      lines: [
        {
          id: "l1",
          text: "hello world",
          agentId: "v1",
          words: [
            { text: "hello ", begin: 0.1, end: 0.5 },
            { text: "world", begin: 0.5, end: 0.9 },
          ],
        },
      ],
    });
    const lines = useProjectStore.getState().lines;
    const before = JSON.stringify(lines);
    const { result } = await renderHook(() => useTimelineDnd(lines));

    result.current.handleDragEnd(
      makeCursorTargetingEvent({
        lineId: "l1",
        lineIndex: 0,
        wordIndex: 0,
        trackType: "word",
        text: "hello",
        begin: 0.1,
        end: 0.5,
        pointerX: 200,
        pointerY: 100,
        deltaX: 0,
        deltaY: 900,
      }),
    );

    const after = JSON.stringify(useProjectStore.getState().lines);
    expect(after).toEqual(before);
  });

  it("switches track when the cursor lands in the bg zone even with only a few pixels of delta.y", async () => {
    useProjectStore.setState({
      lines: [
        {
          id: "l1",
          text: "hello",
          agentId: "v1",
          words: [{ text: "hello", begin: 0.1, end: 0.4 }],
          backgroundText: "ooh",
          backgroundWords: [{ text: "ooh", begin: 1.0, end: 1.4 }],
          backgroundTextSource: "manual",
        },
      ],
    });
    const lines = useProjectStore.getState().lines;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    result.current.handleDragEnd(
      makeCursorTargetingEvent({
        lineId: "l1",
        lineIndex: 0,
        wordIndex: 0,
        trackType: "word",
        text: "hello",
        begin: 0.1,
        end: 0.4,
        pointerX: 100,
        pointerY: 120,
        deltaX: 0,
        deltaY: 5,
      }),
    );

    const after = useProjectStore.getState().lines[0];
    expect(after.words?.length ?? 0).toBe(0);
    expect(after.backgroundWords?.length).toBe(2);
  });
});
