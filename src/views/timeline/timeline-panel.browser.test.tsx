import { describe, expect, it } from "vitest";
import { TimelinePanel } from "@/views/timeline/timeline-panel";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";

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
