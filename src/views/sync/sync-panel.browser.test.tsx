import { flushSync } from "react-dom";
import { describe, expect, it } from "vitest";
import { SyncPanel } from "@/views/sync/sync-panel";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { getShortcutDescription } from "@/stores/shortcut-bindings";
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

describe("SyncPanel · touch sync", () => {
  function loadPlayingProject(text = "Hello world"): void {
    useAudioStore.setState({
      source: { type: "file", file: createAudioFile() },
      duration: 10,
      currentTime: 5,
      isPlaying: true,
    });
    useProjectStore.setState({ lines: [createLine({ text })], activeTab: "sync" });
  }

  function firePointer(element: Element, type: string): void {
    element.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1 }));
  }

  // Playback commits a render between a real press and its release; flushSync
  // reproduces that so the release handler reads the advanced clock.
  function setCurrentTime(seconds: number): void {
    flushSync(() => {
      useAudioStore.setState({ currentTime: seconds });
    });
  }

  it("commits the current word when the tap circle is pressed", async () => {
    loadPlayingProject();
    const screen = await render(<SyncPanel />);

    firePointer(screen.getByRole("button", { name: "Tap to sync" }).element(), "pointerdown");

    await expect.poll(() => useProjectStore.getState().lines[0].words?.[0]?.begin).toBe(5);
  });

  it("opens the word on hold press and closes it on release", async () => {
    loadPlayingProject();
    const screen = await render(<SyncPanel />);

    const holdCircle = screen.getByRole("button", { name: "Hold to sync" });
    firePointer(holdCircle.element(), "pointerdown");

    await expect.poll(() => useProjectStore.getState().lines[0].words?.[0]?.begin).toBe(5);
    await expect.poll(() => useProjectStore.getState().lines[0].words?.[0]?.end).toBe(5);

    setCurrentTime(7);
    firePointer(holdCircle.element(), "pointerup");

    await expect.poll(() => useProjectStore.getState().lines[0].words?.[0]?.end).toBe(7);
  });

  it("advances to the next word when the tap circle is pressed during a hold", async () => {
    loadPlayingProject();
    const screen = await render(<SyncPanel />);

    firePointer(screen.getByRole("button", { name: "Hold to sync" }).element(), "pointerdown");
    await expect.poll(() => useProjectStore.getState().lines[0].words?.length).toBe(1);

    setCurrentTime(7);
    firePointer(screen.getByRole("button", { name: "Tap to sync" }).element(), "pointerdown");

    await expect.poll(() => useProjectStore.getState().lines[0].words?.[0]?.end).toBe(7);
    await expect.poll(() => useProjectStore.getState().lines[0].words?.[1]?.begin).toBe(7);
  });

  it("releases the hold when the pointer is cancelled", async () => {
    loadPlayingProject();
    const screen = await render(<SyncPanel />);

    const holdCircle = screen.getByRole("button", { name: "Hold to sync" });
    firePointer(holdCircle.element(), "pointerdown");
    await expect.poll(() => useProjectStore.getState().lines[0].words?.length).toBe(1);

    setCurrentTime(8);
    firePointer(holdCircle.element(), "pointercancel");

    await expect.poll(() => useProjectStore.getState().lines[0].words?.[0]?.end).toBe(8);
  });

  it("releases the hold when the pointer leaves the circle", async () => {
    loadPlayingProject();
    const screen = await render(<SyncPanel />);

    const holdCircle = screen.getByRole("button", { name: "Hold to sync" });
    firePointer(holdCircle.element(), "pointerdown");
    await expect.poll(() => useProjectStore.getState().lines[0].words?.length).toBe(1);

    setCurrentTime(8);
    // React derives onPointerLeave from the native pointerout event, so a raw
    // "pointerleave" dispatch would never reach the handler.
    firePointer(holdCircle.element(), "pointerout");

    await expect.poll(() => useProjectStore.getState().lines[0].words?.[0]?.end).toBe(8);
  });

  describe("invariants", () => {
    it("suppresses the mobile tap highlight and long-press callout on both circles", async () => {
      loadPlayingProject();
      const screen = await render(<SyncPanel />);

      for (const name of ["Hold to sync", "Tap to sync"]) {
        const circle = screen.getByRole("button", { name }).element();
        expect(circle.className).toContain("tap-highlight-none");
        expect(circle.className).toContain("touch-none");
      }
    });

    it("labels both circles from the shortcut registry, not hardcoded strings", async () => {
      loadPlayingProject();
      const screen = await render(<SyncPanel />);

      await expect
        .element(screen.getByRole("button", { name: getShortcutDescription("sync.tap") }))
        .toBeInTheDocument();
      await expect
        .element(screen.getByRole("button", { name: getShortcutDescription("sync.holdSync") }))
        .toBeInTheDocument();
    });

    it("a pointer hold overlapping a keyboard hold opens the word only once", async () => {
      loadPlayingProject();
      const screen = await render(<SyncPanel />);

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "f", code: "KeyF", bubbles: true }));
      await expect.poll(() => useProjectStore.getState().lines[0].words?.[0]?.begin).toBe(5);

      setCurrentTime(7);
      firePointer(screen.getByRole("button", { name: "Hold to sync" }).element(), "pointerdown");

      await expect.poll(() => useProjectStore.getState().lines[0].words?.[0]?.begin).toBe(5);
      await expect.poll(() => useProjectStore.getState().lines[0].words?.length).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("unmounts the circles in edit mode so presses cannot write timing", async () => {
      loadPlayingProject();
      const screen = await render(<SyncPanel />);
      await screen.getByRole("button", { name: "Edit" }).click();

      await expect.poll(() => screen.getByRole("button", { name: "Tap to sync" }).query()).toBe(null);
      await expect.poll(() => screen.getByRole("button", { name: "Hold to sync" }).query()).toBe(null);
      expect(useProjectStore.getState().lines[0].words).toBeUndefined();
    });

    it("regression: the keyboard tap path still commits after the pointer refactor", async () => {
      loadPlayingProject();
      await render(<SyncPanel />);

      window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));

      await expect.poll(() => useProjectStore.getState().lines[0].words?.[0]?.begin).toBe(5);
    });
  });
});
