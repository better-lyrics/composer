import { reconcileLine } from "@/domain/line/model";
import { bgWords, mainWords } from "@/domain/line/voices";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useTimelineDnd } from "@/views/timeline/use-timeline-dnd";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import {
  installScrollHost,
  makeDragEndEvent,
  makeDragStartEvent,
  POINTER_Y_BG,
  POINTER_Y_MAIN,
} from "@/views/timeline/use-timeline-dnd.test-helpers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";

describe("useTimelineDnd · live shift state", () => {
  let scrollHost: HTMLDivElement;

  beforeEach(() => {
    useAudioStore.setState({ duration: 30 });
    useTimelineStore.setState({ rowHeights: {}, defaultRowHeight: 44, collapsedInstances: {} });
    useProjectStore.setState({
      lines: [
        reconcileLine({
          id: "l1",
          text: "every",
          agentId: "v1",
          words: [
            { text: "ev", begin: 0, end: 0.3, syllableGroupId: "g" },
            { text: "er", begin: 0.3, end: 0.6, syllableGroupId: "g" },
            { text: "y ", begin: 0.6, end: 0.9, syllableGroupId: "g" },
          ],
        }),
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
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 200, clientY: POINTER_Y_BG }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", shiftKey: true, bubbles: true }));
    result.current.handleDragEnd(
      makeDragEndEvent({ overId: "bg-drop-l1", deltaY: 0, activatorShift: false, pointerY: POINTER_Y_BG }),
    );

    const after = useProjectStore.getState().lines[0];
    expect(mainWords(after)?.length ?? 0).toBe(0);
    expect(bgWords(after)?.length).toBe(3);
    const sharedId = bgWords(after)?.[0].syllableGroupId;
    expect(sharedId).toBeDefined();
    expect(bgWords(after)?.[1].syllableGroupId).toBe(sharedId);
    expect(bgWords(after)?.[2].syllableGroupId).toBe(sharedId);
  });

  it("shifts every groupmate by the same delta when a non-leading syllable is shift-dragged", async () => {
    useTimelineStore.setState({ zoom: 100 });
    const zoom = useTimelineStore.getState().zoom;
    const lines = useProjectStore.getState().lines;
    const before = mainWords(lines[0]) ?? [];
    const { result } = await renderHook(() => useTimelineDnd(lines));

    result.current.handleDragStart(makeDragStartEvent(true));
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 260, clientY: POINTER_Y_MAIN }));

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
    const words = mainWords(after) ?? [];
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
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 200, clientY: POINTER_Y_BG }));
    document.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift", shiftKey: false, bubbles: true }));
    result.current.handleDragEnd(
      makeDragEndEvent({ overId: "bg-drop-l1", deltaY: 0, activatorShift: true, pointerY: POINTER_Y_BG }),
    );

    const after = useProjectStore.getState().lines[0];
    expect(mainWords(after)?.length ?? 0).toBe(0);
    expect(bgWords(after)?.length).toBe(3);
    const sharedId = bgWords(after)?.[0].syllableGroupId;
    expect(sharedId).toBeDefined();
    expect(bgWords(after)?.[1].syllableGroupId).toBe(sharedId);
    expect(bgWords(after)?.[2].syllableGroupId).toBe(sharedId);
  });
});
