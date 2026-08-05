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

describe("SyncPanel · tap while already playing", () => {
  function pressTap(): void {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
  }

  it("regression: a single space taps the current word when playback was started outside the sync flow", async () => {
    useAudioStore.setState({
      source: { type: "file", file: createAudioFile() },
      duration: 10,
      currentTime: 5,
      isPlaying: true,
    });
    useProjectStore.setState({ lines: [createLine({ text: "Hello world" })], activeTab: "sync" });
    await render(<SyncPanel />);

    pressTap();

    await expect.poll(() => useProjectStore.getState().lines[0].words?.[0]?.begin).toBe(5);
  });

  it("marks the session active after tapping so Reset becomes available", async () => {
    useAudioStore.setState({
      source: { type: "file", file: createAudioFile() },
      duration: 10,
      currentTime: 5,
      isPlaying: true,
    });
    useProjectStore.setState({ lines: [createLine({ text: "Hello world" })], activeTab: "sync" });
    const screen = await render(<SyncPanel />);

    pressTap();

    await expect.element(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });
});
