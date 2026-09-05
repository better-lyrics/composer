import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { getShortcutDescription } from "@/stores/shortcut-bindings";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { firePointer, loadPlayingProject, setCurrentTime, setIsPlaying } from "@/test/sync-gesture-helpers";
import { SyncPanel } from "@/views/sync/sync-panel";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { describe, expect, it } from "vitest";

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

  it("toggles the Sync display between original and transliteration text", async () => {
    useAudioStore.setState({ source: { type: "file", file: new File(["audio"], "song.mp3") } });
    useProjectStore.setState({
      activeTab: "sync",
      lines: [
        {
          id: "mixed",
          agentId: "v1",
          text: "걸음은 Like",
          transliteration: {
            language: "ko-Latn",
            text: "geol eum eun  Like",
            segments: [{ original: "걸음은 Like", transliteration: "geol eum eun  Like" }],
            origin: "google",
            sourceFingerprint: "test",
          },
        },
      ],
    });
    useTimelineStore.setState({ textVariant: "original" });

    const screen = await render(<SyncPanel />);
    const toggle = screen.getByRole("button", { name: /Original/ });
    await expect.element(toggle).toBeEnabled();
    await toggle.click();

    await expect.element(screen.getByRole("button", { name: /Transliteration/ })).toBeInTheDocument();
    expect(screen.container.textContent).toContain("geol eum eun");
    expect(screen.container.textContent).toContain("Like");
  });

  it("uses canonical timed-word transliterations when line segments cannot be realigned", async () => {
    useAudioStore.setState({ source: { type: "file", file: new File(["audio"], "song.mp3") } });
    useProjectStore.setState({
      activeTab: "sync",
      granularity: "word",
      lines: [
        {
          id: "canonical-words",
          agentId: "v1",
          text: "한국 노래",
          words: [
            { text: "한국 ", transliteration: "hanguk", begin: 0, end: 1 },
            { text: "노래", transliteration: "norae", begin: 1, end: 2 },
          ],
          transliteration: {
            language: "ko-Latn",
            text: "hanguknorae",
            segments: [{ original: "한국 노래", transliteration: "hanguknorae" }],
            origin: "import",
            sourceFingerprint: "test",
          },
        },
      ],
    });
    useTimelineStore.setState({ textVariant: "transliteration" });

    const screen = await render(<SyncPanel />);

    await expect.element(screen.getByText("hanguk", { exact: true })).toBeInTheDocument();
    await expect.element(screen.getByText("norae", { exact: true })).toBeInTheDocument();
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

    it("keeps both circles out of the tab order, the gestures are already bound globally", async () => {
      loadPlayingProject();
      const screen = await render(<SyncPanel />);

      for (const name of ["Hold to sync", "Tap to sync"]) {
        expect(screen.getByRole("button", { name }).element().getAttribute("tabindex")).toBe("-1");
      }
    });

    it("reports hold state to assistive tech through aria-pressed", async () => {
      loadPlayingProject();
      const screen = await render(<SyncPanel />);

      const holdCircle = screen.getByRole("button", { name: "Hold to sync" });
      expect(holdCircle.element().getAttribute("aria-pressed")).toBe("false");

      firePointer(holdCircle.element(), "pointerdown");
      await expect.poll(() => holdCircle.element().getAttribute("aria-pressed")).toBe("true");

      setCurrentTime(7);
      firePointer(holdCircle.element(), "pointerup");
      await expect.poll(() => holdCircle.element().getAttribute("aria-pressed")).toBe("false");
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
    it("unmounts both circles in edit mode", async () => {
      loadPlayingProject();
      const screen = await render(<SyncPanel />);
      await screen.getByRole("button", { name: "Edit" }).click();

      await expect.poll(() => screen.getByRole("button", { name: "Tap to sync" }).query()).toBe(null);
      await expect.poll(() => screen.getByRole("button", { name: "Hold to sync" }).query()).toBe(null);
    });

    it("writes no timing when a tap reaches the panel while editing during playback", async () => {
      loadPlayingProject();
      const screen = await render(<SyncPanel />);
      await screen.getByRole("button", { name: "Edit" }).click();
      await expect.poll(() => screen.getByRole("button", { name: "Tap to sync" }).query()).toBe(null);

      // Entering edit mode pauses, but the transport can be started again.
      setIsPlaying(true);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));

      await expect.poll(() => useProjectStore.getState().lines[0].words).toBeUndefined();
    });

    it("prevents the default press action on both circles so the press cannot steal focus", async () => {
      loadPlayingProject();
      const screen = await render(<SyncPanel />);

      for (const name of ["Hold to sync", "Tap to sync"]) {
        const pressed = firePointer(screen.getByRole("button", { name }).element(), "pointerdown");
        expect(pressed.defaultPrevented).toBe(true);
      }
    });

    it("regression: the keyboard tap path still commits after the pointer refactor", async () => {
      loadPlayingProject();
      await render(<SyncPanel />);

      window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));

      await expect.poll(() => useProjectStore.getState().lines[0].words?.[0]?.begin).toBe(5);
    });
  });
});
