import { describe, expect, it } from "vitest";
import { SyncPanel } from "@/views/sync/sync-panel";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";

// -- Helpers ------------------------------------------------------------------

function loadSyncableProject(): void {
  useAudioStore.setState({ source: { type: "file", file: createAudioFile() }, duration: 10, currentTime: 0 });
  useProjectStore.setState({
    lines: [createLine({ text: "Hello world", words: [createWord({ text: "Hello world", begin: 1, end: 2 })] })],
  });
}

describe("SyncPanel", () => {
  it("shows the 'No audio loaded' empty state when no source is set", async () => {
    useAudioStore.setState({ source: null });
    useProjectStore.setState({ lines: [] });
    const screen = await render(<SyncPanel />);
    await expect.element(screen.getByText("No audio loaded")).toBeInTheDocument();
  });

  it("toggles the Edit button label between Edit and Done", async () => {
    loadSyncableProject();
    const screen = await render(<SyncPanel />);
    await expect.element(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    await screen.getByRole("button", { name: "Edit" }).click();
    await expect.element(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("pauses playback when entering edit mode", async () => {
    loadSyncableProject();
    useAudioStore.setState({ isPlaying: true });
    const screen = await render(<SyncPanel />);
    await screen.getByRole("button", { name: "Edit" }).click();
    await expect.poll(() => useAudioStore.getState().isPlaying).toBe(false);
  });

  it("shows the editing hint while in edit mode", async () => {
    loadSyncableProject();
    const screen = await render(<SyncPanel />);
    await screen.getByRole("button", { name: "Edit" }).click();
    await expect.element(screen.getByText(/Editing timings/)).toBeInTheDocument();
  });
});
