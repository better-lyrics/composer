import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { backgroundTrack, timedSyllables } from "@/domain/line/track";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useTimelineDnd } from "@/views/timeline/use-timeline-dnd";
import {
  installScrollHost,
  makeBgReorderDragEndEvent,
  makeBgReorderDragStartEvent,
} from "@/views/timeline/use-timeline-dnd.test-helpers";

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
          words: [{ id: "w1", text: "main", sep: "", begin: 0, end: 0.5 }],
          backgroundText: "ooh aah",
          backgroundWords: [
            { id: "w2", text: "ooh", sep: " ", begin: 0, end: 0.5 },
            { id: "w3", text: "aah", sep: "", begin: 1, end: 1.5 },
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

    result.current.handleDragStart(makeBgReorderDragStartEvent());
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 220, clientY: 140 }));
    result.current.handleDragEnd(makeBgReorderDragEndEvent(-80));

    const after = useProjectStore.getState().lines[0];
    expect(backgroundTrack(after)?.source).toBe("manual");
    expect(after.backgroundWords?.length).toBe(2);
  });

  it("preserves the dragged background word texts and count", async () => {
    const lines = useProjectStore.getState().lines;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    result.current.handleDragStart(makeBgReorderDragStartEvent());
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 220, clientY: 140 }));
    result.current.handleDragEnd(makeBgReorderDragEndEvent(-80));

    const bg = timedSyllables(backgroundTrack(useProjectStore.getState().lines[0]));
    expect(bg).toHaveLength(2);
    expect(bg.map((w) => w.text.trim()).toSorted()).toEqual(["aah", "ooh"]);
  });
});
