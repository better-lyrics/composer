import { mainTrack, roleWords } from "@/domain/line/track";
import { fieldsOfLine, lineFromFields } from "@/domain/line/line-from-fields";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useTimelineDnd } from "@/views/timeline/use-timeline-dnd";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import {
  POINTER_Y_MAIN,
  installScrollHost,
  makeCursorTargetingEvent,
  makeCursorTargetingStartEvent,
} from "@/views/timeline/use-timeline-dnd.test-helpers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";

type Opts = Parameters<typeof makeCursorTargetingEvent>[0];

async function drag(result: { current: ReturnType<typeof useTimelineDnd> }, opts: Opts) {
  result.current.handleDragStart(makeCursorTargetingStartEvent(opts));
  window.dispatchEvent(new PointerEvent("pointermove", { clientX: opts.pointerX, clientY: opts.pointerY }));
  result.current.handleDragEnd(makeCursorTargetingEvent(opts));
}

describe("drag timing kind on drawn lines", () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    useAudioStore.setState({ duration: 30 });
    useTimelineStore.setState({
      zoom: 100,
      rowHeights: {},
      defaultRowHeight: 44,
      collapsedInstances: {},
      selectedWords: [],
    });
    host = installScrollHost();
  });
  afterEach(() => host.remove());

  it("D6: cross-line word drag leaves an unrelated line-synced line line-synced", async () => {
    useProjectStore.setState({
      lines: [
        lineFromFields({
          id: "lA",
          text: "alpha beta",
          agentId: "v1",
          words: [
            { id: "w1", text: "alpha", sep: " ", begin: 0.1, end: 0.4, joinsNext: false },
            { id: "w2", text: "beta", sep: "", begin: 0.4, end: 0.7, joinsNext: false },
          ],
        }),
        lineFromFields({
          id: "lB",
          text: "delta",
          agentId: "v1",
          words: [{ id: "w3", text: "delta", sep: "", begin: 5.0, end: 5.4, joinsNext: false }],
        }),
        lineFromFields({ id: "lC", text: "Line synced only", agentId: "v1", begin: 17, end: 20 }),
      ],
    });
    const { lines } = useProjectStore.getState();
    const { result } = await renderHook(() => useTimelineDnd(lines));
    await drag(result, {
      lineId: "lA",
      lineIndex: 0,
      wordIndex: 0,
      trackType: "word",
      text: "alpha",
      begin: 0.1,
      end: 0.4,
      pointerX: 200,
      pointerY: 170,
      deltaX: 600,
      deltaY: 60,
    });
    const after = useProjectStore.getState().lines;
    expect(
      roleWords(
        after.find((l) => l.id === "lB"),
        "main",
      )?.some((w) => w.text.trim() === "alpha"),
    ).toBe(true);
    expect(fieldsOfLine(after.find((l) => l.id === "lC")!)).toEqual({
      id: "lC",
      text: "Line synced only",
      agentId: "v1",
      begin: 17,
      end: 20,
    });
  });

  it("D6 sibling: dropping onto a line-synced target is rejected (validateMoves isLineSynced guard)", async () => {
    useProjectStore.setState({
      lines: [
        lineFromFields({
          id: "lA",
          text: "alpha beta",
          agentId: "v1",
          words: [
            { id: "w5", text: "alpha", sep: " ", begin: 0.1, end: 0.4, joinsNext: false },
            { id: "w6", text: "beta", sep: "", begin: 0.4, end: 0.7, joinsNext: false },
          ],
        }),
        lineFromFields({ id: "lB", text: "delta", agentId: "v1", begin: 5.0, end: 5.4 }),
      ],
    });
    const { lines } = useProjectStore.getState();
    const { result } = await renderHook(() => useTimelineDnd(lines));
    await drag(result, {
      lineId: "lA",
      lineIndex: 0,
      wordIndex: 0,
      trackType: "word",
      text: "alpha",
      begin: 0.1,
      end: 0.4,
      pointerX: 200,
      pointerY: 170,
      deltaX: 600,
      deltaY: 60,
    });
    const after = useProjectStore.getState().lines;
    expect(
      roleWords(
        after.find((l) => l.id === "lA"),
        "main",
      )?.length,
    ).toBe(2);
    expect(
      roleWords(
        after.find((l) => l.id === "lB"),
        "main",
      ),
    ).toBeUndefined();
  });

  it("D7: same-line drag of a line-synced block keeps it line-synced and shifts begin/end", async () => {
    useProjectStore.setState({
      lines: [lineFromFields({ id: "lC", text: "Line synced only", agentId: "v1", begin: 5, end: 8 })],
    });
    const { lines } = useProjectStore.getState();
    const { result } = await renderHook(() => useTimelineDnd(lines));
    await drag(result, {
      lineId: "lC",
      lineIndex: 0,
      wordIndex: 0,
      trackType: "word",
      text: "Line synced only",
      begin: 5,
      end: 8,
      pointerX: 600,
      pointerY: POINTER_Y_MAIN,
      deltaX: 100,
      deltaY: 0,
    });
    const after = useProjectStore.getState().lines[0];
    expect(roleWords(after, "main")).toBeUndefined();
    expect(mainTrack(after).begin).toBeCloseTo(6);
    expect(mainTrack(after).end).toBeCloseTo(9);
  });
});
