import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { lineFromFields } from "@/domain/line/line-from-fields";
import { mainTrack, roleWords, timedSyllables } from "@/domain/line/track";
import { computeSyllableGroups } from "@/domain/word/syllable-groups";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useTimelineDnd } from "@/views/timeline/use-timeline-dnd";
import {
  installScrollHost,
  makeDragEndEvent,
  makeDragStartEvent,
  POINTER_Y_BG,
  POINTER_Y_MAIN,
} from "@/views/timeline/use-timeline-dnd.test-helpers";

describe("useTimelineDnd · live shift state", () => {
  let scrollHost: HTMLDivElement;

  beforeEach(() => {
    useAudioStore.setState({ duration: 30 });
    useTimelineStore.setState({ rowHeights: {}, defaultRowHeight: 44, collapsedInstances: {} });
    useProjectStore.setState({
      lines: [
        lineFromFields({
          id: "l1",
          text: "every",
          agentId: "v1",
          words: [
            { id: "w1", text: "ev", sep: "", begin: 0, end: 0.3, joinsNext: true },
            { id: "w2", text: "er", sep: "", begin: 0.3, end: 0.6, joinsNext: true },
            { id: "w3", text: "y", sep: " ", begin: 0.6, end: 0.9, joinsNext: false },
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
    expect(timedSyllables(mainTrack(after)).length).toBe(0);
    expect(roleWords(after, "bg")?.length).toBe(3);
    expect(computeSyllableGroups(roleWords(after, "bg") ?? [])).toMatchObject([{ startIndex: 0, endIndex: 2 }]);
  });

  it("shifts every groupmate by the same delta when a non-leading syllable is shift-dragged", async () => {
    useTimelineStore.setState({ zoom: 100 });
    const zoom = useTimelineStore.getState().zoom;
    const lines = useProjectStore.getState().lines;
    const before = timedSyllables(mainTrack(lines[0]));
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
    const words = timedSyllables(mainTrack(after));
    expect(words.length).toBe(3);

    const expectedShift = deltaX / zoom;
    expect(expectedShift).toBeGreaterThan(0.1);
    expect(words[0].begin).toBeCloseTo(before[0].begin + expectedShift, 4);
    expect(words[1].begin).toBeCloseTo(before[1].begin + expectedShift, 4);
    expect(words[2].begin).toBeCloseTo(before[2].begin + expectedShift, 4);

    for (let i = 1; i < words.length; i++) {
      expect(words[i].begin).toBeCloseTo(words[i - 1].end, 5);
    }
    expect(computeSyllableGroups(words)).toMatchObject([{ startIndex: 0, endIndex: 2 }]);
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
    expect(timedSyllables(mainTrack(after)).length).toBe(0);
    expect(roleWords(after, "bg")?.length).toBe(3);
    expect(computeSyllableGroups(roleWords(after, "bg") ?? [])).toMatchObject([{ startIndex: 0, endIndex: 2 }]);
  });
});
