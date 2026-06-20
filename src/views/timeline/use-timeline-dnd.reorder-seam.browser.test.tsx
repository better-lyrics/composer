import { reconcileLine } from "@/domain/line/model";
import { mainWords } from "@/domain/line/voices";
import { computeSyllableGroups } from "@/domain/word/syllable-groups";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useTimelineDnd } from "@/views/timeline/use-timeline-dnd";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import {
  installScrollHost,
  makeReorderDragEndEvent,
  makeReorderDragStartEvent,
  POINTER_Y_MAIN,
} from "@/views/timeline/use-timeline-dnd.test-helpers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";

describe("useTimelineDnd · within-track reorder seam", () => {
  let scrollHost: HTMLDivElement;

  beforeEach(() => {
    useAudioStore.setState({ duration: 30 });
    useTimelineStore.setState({ zoom: 100, rowHeights: {}, defaultRowHeight: 44, collapsedInstances: {} });
    useProjectStore.setState({
      lines: [
        reconcileLine({
          id: "l1",
          text: "word1 word2 word3",
          agentId: "v1",
          words: [
            { text: "word1 ", begin: 0, end: 0.5 },
            { text: "word2 ", begin: 1, end: 1.5 },
            { text: "word3", begin: 2, end: 2.5 },
          ],
        }),
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
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 250, clientY: POINTER_Y_MAIN }));
    result.current.handleDragEnd(makeReorderDragEndEvent());

    const words = mainWords(useProjectStore.getState().lines[0]) ?? [];
    expect(words.length).toBe(3);

    expect(computeSyllableGroups(words)).toEqual([]);

    const word3 = words.find((w) => w.text.trim() === "word3");
    expect(word3?.text).toBe("word3 ");
    expect(words[words.length - 1].text.endsWith(" ")).toBe(false);

    expect(words.map((w) => w.text.trim())).toEqual(["word1", "word3", "word2"]);
  });
});
