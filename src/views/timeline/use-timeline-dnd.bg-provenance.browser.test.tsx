import { reconcileLine } from "@/domain/line/model";
import { bgSource, bgWords } from "@/domain/line/voices";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useTimelineDnd } from "@/views/timeline/use-timeline-dnd";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import {
  installScrollHost,
  makeBgReorderDragEndEvent,
  makeBgReorderDragStartEvent,
} from "@/views/timeline/use-timeline-dnd.test-helpers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";

describe("useTimelineDnd · background-word drag provenance", () => {
  let scrollHost: HTMLDivElement;

  beforeEach(() => {
    useAudioStore.setState({ duration: 30 });
    useTimelineStore.setState({ zoom: 100, rowHeights: {}, defaultRowHeight: 44, collapsedInstances: {} });
    useProjectStore.setState({
      lines: [
        reconcileLine({
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
        }),
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

    result.current.handleDragStart(makeBgReorderDragStartEvent());
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 220, clientY: 140 }));
    result.current.handleDragEnd(makeBgReorderDragEndEvent(-80));

    const after = useProjectStore.getState().lines[0];
    expect(bgSource(after)).toBe("manual");
    expect(bgWords(after)?.length).toBe(2);
  });

  it("preserves the dragged background word texts and count", async () => {
    const lines = useProjectStore.getState().lines;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    result.current.handleDragStart(makeBgReorderDragStartEvent());
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 220, clientY: 140 }));
    result.current.handleDragEnd(makeBgReorderDragEndEvent(-80));

    const bg = bgWords(useProjectStore.getState().lines[0]) ?? [];
    expect(bg).toHaveLength(2);
    expect(bg.map((w) => w.text.trim()).toSorted()).toEqual(["aah", "ooh"]);
  });
});
