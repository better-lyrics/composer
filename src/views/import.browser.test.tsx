import { describe, expect, it } from "vitest";
import { ImportPanel } from "@/views/import";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { render } from "@/test/render";

describe("ImportPanel", () => {
  it("renders the audio drop zone when no source is loaded", async () => {
    useAudioStore.setState({ source: null });
    useProjectStore.setState({ lines: [] });
    const screen = await render(<ImportPanel />);
    expect(screen.container.textContent ?? "").not.toBe("");
  });
});
