import { describe, expect, it } from "vitest";
import type { WordSelection } from "@/domain/selection/model";
import { TimelinePanel } from "@/views/timeline/timeline-panel";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";

// -- Helpers ------------------------------------------------------------------

function seedPlayheadTime(time: number): void {
  useAudioStore.setState({ currentTime: time });
  const audioElement = useAudioStore.getState().audioElement;
  if (audioElement) audioElement.currentTime = time;
}

function pressSelectWordAtPlayhead(): void {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
}

describe("TimelinePanel", () => {
  it("shows the audio drop zone when no source is loaded", async () => {
    useAudioStore.setState({ source: null });
    useProjectStore.setState({ lines: [] });
    const screen = await render(<TimelinePanel />);
    await expect.element(screen.getByText("Drop audio file here")).toBeInTheDocument();
  });

  it("renders the Timeline header once an audio source is set", async () => {
    useAudioStore.setState({ source: { type: "file", file: createAudioFile() }, duration: 30 });
    useProjectStore.setState({
      lines: [createLine({ text: "first lyric", words: [createWord({ text: "first", begin: 0, end: 1 })] })],
    });
    const screen = await render(<TimelinePanel />);
    await expect.element(screen.getByRole("heading", { name: "Timeline" })).toBeInTheDocument();
  });
});

describe("select word under playhead", () => {
  const lineId = "line-playhead";

  function seedTimelineWithWords(): void {
    useAudioStore.setState({ source: { type: "file", file: createAudioFile() }, duration: 30 });
    useProjectStore.setState({
      activeTab: "timeline",
      lines: [
        createLine({
          id: lineId,
          text: "alpha beta",
          words: [createWord({ text: "alpha", begin: 0, end: 1 }), createWord({ text: "beta", begin: 1, end: 2 })],
          backgroundText: "echo",
          backgroundWords: [createWord({ text: "echo", begin: 0.4, end: 0.9 })],
        }),
      ],
    });
  }

  const mainWordZero: WordSelection = { lineId, lineIndex: 0, wordIndex: 0, type: "word" };
  const bgWordZero: WordSelection = { lineId, lineIndex: 0, wordIndex: 0, type: "bg" };

  it("selects the main word under the playhead, then cycles to the overlapping background word and wraps", async () => {
    seedTimelineWithWords();
    await render(<TimelinePanel />);
    seedPlayheadTime(0.5);

    pressSelectWordAtPlayhead();
    await expect.poll(() => useTimelineStore.getState().selectedWords).toEqual([mainWordZero]);

    pressSelectWordAtPlayhead();
    await expect.poll(() => useTimelineStore.getState().selectedWords).toEqual([bgWordZero]);

    pressSelectWordAtPlayhead();
    await expect.poll(() => useTimelineStore.getState().selectedWords).toEqual([mainWordZero]);
  });

  it("leaves the selection empty when the playhead is past every word", async () => {
    seedTimelineWithWords();
    await render(<TimelinePanel />);
    seedPlayheadTime(10);

    pressSelectWordAtPlayhead();
    await expect.poll(() => useTimelineStore.getState().selectedWords).toEqual([]);
  });
});
