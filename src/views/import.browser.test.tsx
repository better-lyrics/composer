import { describe, expect, it } from "vitest";
import { ImportPanel } from "@/views/import";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { render } from "@/test/render";

describe("ImportPanel", () => {
  it("renders the audio drop zone when no source is loaded", async () => {
    useAudioStore.setState({ source: null });
    useProjectStore.setState({ lines: [] });
    const screen = await render(<ImportPanel />);
    expect(screen.container.textContent ?? "").not.toBe("");
  });

  it("shows the loading spinner for a file source while it is loading", async () => {
    useAudioStore.setState({ source: { type: "file", file: createAudioFile() }, isLoading: true, duration: 0 });
    const screen = await render(<ImportPanel />);
    expect(screen.container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("shows the clock and resolved duration for a loaded file source", async () => {
    useAudioStore.setState({ source: { type: "file", file: createAudioFile() }, isLoading: false, duration: 90 });
    const screen = await render(<ImportPanel />);
    expect(screen.container.querySelector(".animate-spin")).toBeNull();
    expect(screen.container.textContent).toContain("1:30");
  });

  it("shows the loading spinner for a downloading YouTube source", async () => {
    useAudioStore.setState({ source: { type: "youtube", videoId: "abc123" }, isLoading: true });
    const screen = await render(<ImportPanel />);
    expect(screen.container.querySelector(".animate-spin")).not.toBeNull();
  });
});
