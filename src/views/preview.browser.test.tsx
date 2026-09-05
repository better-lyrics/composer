import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useUIStore } from "@/stores/ui";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { generateTTML } from "@/utils/ttml";
import { PreviewPanel } from "@/views/preview";
import { describe, expect, it } from "vitest";

describe("PreviewPanel", () => {
  it("shows the 'No audio loaded' empty state when no source is set", async () => {
    useAudioStore.setState({ source: null });
    useProjectStore.setState({ lines: [] });
    const screen = await render(<PreviewPanel />);
    await expect.element(screen.getByText("No audio loaded")).toBeInTheDocument();
  });

  it("renders the exact manually edited TTML that Export uses", async () => {
    useAudioStore.setState({
      source: { type: "file", file: createAudioFile() },
      audioElement: new Audio(),
      duration: 10,
    });
    useProjectStore.setState({
      lines: [createLine({ text: "Hi", words: [createWord({ text: "Hi", begin: 0, end: 1 })] })],
    });

    const project = useProjectStore.getState();
    const generated = generateTTML({
      metadata: project.metadata,
      agents: project.agents,
      lines: project.lines,
      groups: project.groups,
      granularity: project.granularity,
      duration: useAudioStore.getState().duration,
    });
    const edited = generated.replace(">Hi</span>", ">Edited in Export</span>");
    expect(edited).not.toBe(generated);
    useUIStore.getState().setTtmlEditState({ source: generated, content: edited });

    const screen = await render(<PreviewPanel />);

    await expect
      .poll(() => screen.container.querySelector(".blyrics--line")?.textContent ?? "")
      .toContain("Edited in Export");
  });
});
