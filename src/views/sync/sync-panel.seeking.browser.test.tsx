import { AudioPlayer } from "@/audio/audio-player";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { useAudioStore } from "@/stores/audio";
import { useModalStackStore } from "@/stores/modal-stack";
import { useProjectStore } from "@/stores/project";
import { assignBinding, useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { TabBar } from "@/ui/tab-bar";
import { SyncPanel } from "@/views/sync/sync-panel";
import { flushSync } from "react-dom";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

async function setup(granularity: "word" | "line" = "word") {
  const audioElement = new Audio();
  audioElement.currentTime = 5;
  useAudioStore.setState({
    source: { type: "file", file: createAudioFile() },
    audioElement,
    duration: 60,
    currentTime: 5,
    isPlaying: false,
    playbackRate: 1,
    volume: 0.8,
  });
  useProjectStore.setState({
    lines: [createLine({ id: "l0", text: "one two three" })],
    activeTab: "edit",
    granularity,
  });
  const screen = await render(
    <>
      <TabBar />
      <SyncPanel />
      <AudioPlayer />
      <input aria-label="Text input" />
      <textarea aria-label="Text area" />
      <div contentEditable suppressContentEditableWarning aria-label="Editable text">
        editable
      </div>
    </>,
  );
  const syncTab = screen.getByRole("button", { name: /^Sync/ });
  await syncTab.click();
  expect(document.activeElement).toBe(syncTab.element());
  return { screen, audioElement, syncTab };
}

function expectProjectUnchanged(before: ReturnType<typeof useProjectStore.getState>) {
  const after = useProjectStore.getState();
  expect(after.lines).toBe(before.lines);
  expect(after.history).toBe(before.history);
  expect(after.historyIndex).toBe(before.historyIndex);
}

async function clickSeeker(screen: Awaited<ReturnType<typeof setup>>["screen"]) {
  const seeker = screen.getByRole("slider", { name: "Audio progress" });
  // Tailwind is not loaded in browser tests; give the track its production height.
  seeker.element().style.height = "4px";
  await seeker.click();
  expect(document.activeElement).toBe(seeker.element());
  return seeker;
}

async function syncFirstWord(screen: Awaited<ReturnType<typeof setup>>["screen"]) {
  await screen.getByRole("button", { name: "Start", exact: true }).click();
  await userEvent.keyboard(" ");
  await expect.poll(() => useProjectStore.getState().lines[0].words?.length).toBe(1);
}

describe("SyncPanel playback shortcuts", () => {
  it.each(["word", "line"] as const)(
    "seeks immediately on entering %s sync without clicking the seeker",
    async (mode) => {
      const { audioElement, syncTab } = await setup(mode);
      const before = useProjectStore.getState();
      await userEvent.keyboard("{ArrowLeft}");
      expect(audioElement.currentTime).toBe(4);
      expect(useAudioStore.getState().currentTime).toBe(4);
      await userEvent.keyboard("{ArrowRight}");
      expect(audioElement.currentTime).toBe(5);
      expect(document.activeElement).toBe(syncTab.element());
      expectProjectUnchanged(before);
      expect(useAudioStore.getState().isPlaying).toBe(false);

      flushSync(() => useProjectStore.setState({ activeTab: "edit" }));
      await syncTab.click();
      await userEvent.keyboard("{ArrowRight}");
      expect(audioElement.currentTime).toBe(6);
      expectProjectUnchanged(before);
    },
  );

  it("seeks after starting sync and uses the live playback clock", async () => {
    const { screen, audioElement } = await setup();
    await screen.getByRole("button", { name: "Start", exact: true }).click();
    audioElement.currentTime = 5.25;
    const before = useProjectStore.getState();
    await userEvent.keyboard("{ArrowRight}");
    expect(audioElement.currentTime).toBe(6.25);
    expect(useAudioStore.getState().currentTime).toBe(6.25);
    expect(useAudioStore.getState().isPlaying).toBe(true);
    expectProjectUnchanged(before);
  });

  it("seeks once from the focused seeker without nudging lyric timings", async () => {
    const { screen, audioElement } = await setup();
    await syncFirstWord(screen);
    await clickSeeker(screen);
    const time = audioElement.currentTime;
    const before = useProjectStore.getState();
    await userEvent.keyboard("{ArrowLeft}");
    expect(audioElement.currentTime).toBe(time - 1);
    expectProjectUnchanged(before);
    await userEvent.keyboard("{ArrowRight}");
    expect(audioElement.currentTime).toBe(time);
    expectProjectUnchanged(before);
  });

  it("nudges with Shift+arrows on the focused seeker without seeking or repeating the nudge", async () => {
    const { screen, audioElement } = await setup();
    await syncFirstWord(screen);
    const seeker = await clickSeeker(screen);
    const time = audioElement.currentTime;
    const before = useProjectStore.getState();
    await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}");
    expect(useProjectStore.getState().lines[0].words?.[0].begin).toBeCloseTo(4.95);
    expect(useProjectStore.getState().history.length).toBe(before.history.length + 1);
    expect(audioElement.currentTime).toBe(time);
    const afterNudge = useProjectStore.getState();
    seeker.element().dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        shiftKey: true,
        repeat: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expectProjectUnchanged(afterNudge);
    expect(audioElement.currentTime).toBe(time);
    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");
    expect(useProjectStore.getState().lines[0].words?.[0].begin).toBeCloseTo(5);
    expect(audioElement.currentTime).toBe(time);
  });

  it("honors rebound seeking directions even when the seeker has focus", async () => {
    const { screen, audioElement } = await setup();
    assignBinding("sync.seekForward", { key: "ArrowLeft" });
    assignBinding("sync.seekBackward", { key: "ArrowRight" });
    await clickSeeker(screen);
    const time = audioElement.currentTime;
    const before = useProjectStore.getState();
    await userEvent.keyboard("{ArrowLeft}");
    expect(audioElement.currentTime).toBe(time + 1);
    await userEvent.keyboard("{ArrowRight}");
    expect(audioElement.currentTime).toBe(time);
    expectProjectUnchanged(before);
  });

  it("respects an existing custom nudge binding when it overlaps a new seek default", async () => {
    const { screen, audioElement } = await setup();
    await syncFirstWord(screen);
    useShortcutBindingsStore.setState({ overrides: { "sync.nudgeLeft": { key: "ArrowLeft" } } });
    const time = audioElement.currentTime;
    await userEvent.keyboard("{ArrowLeft}");
    expect(useProjectStore.getState().lines[0].words?.[0].begin).toBeCloseTo(4.95);
    expect(audioElement.currentTime).toBe(time);
  });

  it("lets an existing global shortcut take priority over a new seek default", async () => {
    const { audioElement } = await setup();
    const openHelp = vi.fn();
    function GlobalShortcuts() {
      useGlobalShortcuts({
        setActiveTab: useProjectStore.getState().setActiveTab,
        setHelpOpen: openHelp,
        setSettingsOpen: vi.fn(),
      });
      return null;
    }
    useShortcutBindingsStore.setState({ overrides: { "global.help": { key: "ArrowLeft" } } });
    await render(<GlobalShortcuts />);
    await userEvent.keyboard("{ArrowLeft}");
    expect(openHelp).toHaveBeenCalledWith(true);
    expect(audioElement.currentTime).toBe(5);
  });

  it("repeats seeking and clamps it to the song bounds", async () => {
    const { audioElement } = await setup();
    const before = useProjectStore.getState();
    const press = (key: string) =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key,
          repeat: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    press("ArrowRight");
    press("ArrowRight");
    expect(audioElement.currentTime).toBe(7);
    flushSync(() => useAudioStore.getState().seekTo(0.25));
    press("ArrowLeft");
    expect(audioElement.currentTime).toBe(0);
    flushSync(() => useAudioStore.getState().seekTo(59.75));
    press("ArrowRight");
    expect(audioElement.currentTime).toBe(60);
    expectProjectUnchanged(before);
  });

  it.each(["Text input", "Text area", "Editable text"])("leaves arrow keys to %s", async (label) => {
    const { screen, audioElement } = await setup();
    await syncFirstWord(screen);
    const field = screen.container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
    field?.focus();
    const before = useProjectStore.getState();
    await userEvent.keyboard("{ArrowLeft}{ArrowRight}{Shift>}{ArrowLeft}{/Shift}");
    expect(audioElement.currentTime).toBe(5);
    expectProjectUnchanged(before);
  });

  it.each(["Volume", "Playback rate"])("lets the focused %s slider own its keys", async (label) => {
    const { screen, audioElement } = await setup();
    await syncFirstWord(screen);
    await screen.getByRole("button", { name: label === "Volume" ? "Volume" : /1\.00x/ }).click();
    const slider = screen.getByRole("slider", { name: label });
    slider.element().focus();
    const before = useProjectStore.getState();
    const originalValue = Number(slider.element().getAttribute("aria-valuenow"));
    await userEvent.keyboard("{ArrowLeft}");
    expect(Number(slider.element().getAttribute("aria-valuenow"))).toBeLessThan(originalValue);
    expect(audioElement.currentTime).toBe(5);
    expectProjectUnchanged(before);
  });

  it("ignores shortcuts outside Sync, with a modal open, or without loaded audio", async () => {
    const { audioElement } = await setup();
    const before = useProjectStore.getState();
    flushSync(() => useProjectStore.setState({ activeTab: "timeline" }));
    await userEvent.keyboard("{ArrowLeft}");
    flushSync(() => useProjectStore.setState({ activeTab: "sync" }));
    useModalStackStore.setState({ count: 1 });
    await userEvent.keyboard("{ArrowRight}");
    useModalStackStore.setState({ count: 0 });
    flushSync(() => useAudioStore.setState({ source: null }));
    await userEvent.keyboard("{ArrowLeft}");
    expect(audioElement.currentTime).toBe(5);
    expectProjectUnchanged(before);
  });
});
