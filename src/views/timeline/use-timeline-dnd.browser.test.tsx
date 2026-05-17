import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useTimelineDnd } from "@/views/timeline/use-timeline-dnd";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";

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

function makeDragEndEvent(overId: string, deltaY: number, activatorShift: boolean, deltaX = 5): DragEndEvent {
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
    activatorEvent: new PointerEvent("pointerdown", { shiftKey: activatorShift }),
    collisions: null,
  } as unknown as DragEndEvent;
}

describe("useTimelineDnd · live shift state", () => {
  beforeEach(() => {
    useAudioStore.setState({ duration: 30 });
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
  });

  it("moves the whole group across tracks when shift is pressed mid-drag, even though pointerdown had no shift", async () => {
    const lines = useProjectStore.getState().lines;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    result.current.handleDragStart(makeDragStartEvent(false));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", shiftKey: true, bubbles: true }));
    result.current.handleDragEnd(makeDragEndEvent("bg-drop-l1", 50, false));

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
    result.current.handleDragEnd(makeDragEndEvent("main-drop-l1", 0, true, deltaX));

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
    result.current.handleDragEnd(makeDragEndEvent("bg-drop-l1", 50, true));

    const after = useProjectStore.getState().lines[0];
    expect(after.words?.length ?? 0).toBe(0);
    expect(after.backgroundWords?.length).toBe(3);
    const sharedId = after.backgroundWords?.[0].syllableGroupId;
    expect(sharedId).toBeDefined();
    expect(after.backgroundWords?.[1].syllableGroupId).toBe(sharedId);
    expect(after.backgroundWords?.[2].syllableGroupId).toBe(sharedId);
  });
});
