import { useProjectStore } from "@/stores/project";
import { useTimelineDnd } from "@/views/timeline/use-timeline-dnd";
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

function makeDragEndEvent(overId: string, deltaY: number, activatorShift: boolean): DragEndEvent {
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
    delta: { x: 5, y: deltaY },
    activatorEvent: new PointerEvent("pointerdown", { shiftKey: activatorShift }),
    collisions: null,
  } as unknown as DragEndEvent;
}

describe("useTimelineDnd · live shift state", () => {
  beforeEach(() => {
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

  it("starts with dragShiftPressed=false when not actively dragging", async () => {
    const { result } = await renderHook(() =>
      useTimelineDnd([
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
      ]),
    );

    expect(result.current.dragShiftPressed).toBe(false);
  });

  it("detaches the syllable when shift is pressed mid-drag, even though pointerdown had no shift", async () => {
    const lines = useProjectStore.getState().lines;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    result.current.handleDragStart(makeDragStartEvent(false));
    await expect.poll(() => result.current.activeDrag).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", shiftKey: true, bubbles: true }));
    await expect.poll(() => result.current.dragShiftPressed).toBe(true);
    result.current.handleDragEnd(makeDragEndEvent("bg-drop-l1", 50, false));

    const after = useProjectStore.getState().lines[0];
    expect(after.words?.length).toBe(2);
    expect(after.words?.map((w) => w.text)).toEqual(["ev", "y"]);
    expect(after.backgroundWords?.length).toBe(1);
    expect(after.backgroundWords?.[0].text).toBe("er");
    expect(after.backgroundWords?.[0].syllableGroupId).toBeUndefined();
  });

  it("moves the whole group when shift is released mid-drag, even though pointerdown had shift", async () => {
    const lines = useProjectStore.getState().lines;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    result.current.handleDragStart(makeDragStartEvent(true));
    await expect.poll(() => result.current.dragShiftPressed).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift", shiftKey: false, bubbles: true }));
    await expect.poll(() => result.current.dragShiftPressed).toBe(false);
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
