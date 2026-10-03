import { AudioPlayer } from "@/audio/audio-player";
import type { LyricLine } from "@/domain/line/model";
import { useAudioStore } from "@/stores/audio";
import { useModalStackStore } from "@/stores/modal-stack";
import { useProjectStore } from "@/stores/project";
import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { setCurrentTime } from "@/test/sync-gesture-helpers";
import { SyncPanel } from "@/views/sync/sync-panel";
import { flushSync } from "react-dom";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

function load(lines: LyricLine[], granularity: "word" | "line" = "word") {
  useAudioStore.setState({
    source: { type: "file", file: createAudioFile() },
    duration: 60,
    currentTime: 0,
    isPlaying: true,
  });
  useProjectStore.setState({ lines, activeTab: "sync", granularity });
}

function press(key: string, init: KeyboardEventInit = {}, type: "keydown" | "keyup" = "keydown"): KeyboardEvent {
  const event = new KeyboardEvent(type, {
    key,
    code: key === " " ? "Space" : key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  window.dispatchEvent(event);
  return event;
}

function selectedWord(container: HTMLElement): string | null | undefined {
  return container.querySelector('button[aria-label="Tap to sync"]')?.parentElement?.previousElementSibling
    ?.textContent;
}

function expectUnchanged(before: ReturnType<typeof useProjectStore.getState>, time = 0) {
  const after = useProjectStore.getState();
  expect(after.lines).toBe(before.lines);
  expect(after.history).toBe(before.history);
  expect(after.historyIndex).toBe(before.historyIndex);
  expect(useAudioStore.getState().currentTime).toBe(time);
  expect(useAudioStore.getState().isPlaying).toBe(true);
}

async function renderWithSeeker() {
  const audioElement = new Audio();
  useAudioStore.getState().registerAudioElement(audioElement);
  const screen = await render(
    <>
      <SyncPanel />
      <AudioPlayer />
    </>,
  );
  const seeker = screen.getByRole("slider", { name: "Audio progress" });
  // Browser tests do not load Tailwind; give the track its production height for the click.
  seeker.element().style.height = "4px";
  await seeker.click();
  expect(document.activeElement).toBe(seeker.element());
  return { screen, seeker, audioElement };
}

describe("SyncPanel cursor navigation", () => {
  it.each(["word", "line"] as const)(
    "navigates after clicking the seeker without seeking in %s mode",
    async (granularity) => {
      load(
        [
          createLine({
            text: "one two",
            words: [
              { text: "one ", begin: 1, end: 2 },
              { text: "two", begin: 2, end: 3 },
            ],
          }),
          createLine({
            text: "three four",
            words: [
              { text: "three ", begin: 10, end: 11 },
              { text: "four", begin: 11, end: 12 },
            ],
          }),
        ],
        granularity,
      );
      const { screen, seeker, audioElement } = await renderWithSeeker();
      const time = audioElement.currentTime;
      const before = useProjectStore.getState();

      await userEvent.keyboard("{ArrowUp}");
      await expect.poll(() => selectedWord(screen.container)).toBe(granularity === "word" ? "two" : "three");
      expectUnchanged(before, time);
      expect(audioElement.currentTime).toBe(time);

      for (const key of ["ArrowUp", "ArrowDown"]) {
        seeker
          .element()
          .dispatchEvent(
            new KeyboardEvent("keydown", { key, code: key, repeat: true, bubbles: true, cancelable: true }),
          );
      }
      expectUnchanged(before, time);
      expect(audioElement.currentTime).toBe(time);
      expect(selectedWord(screen.container)).toBe(granularity === "word" ? "two" : "three");

      await userEvent.keyboard("{ArrowDown}");
      await expect.poll(() => selectedWord(screen.container)).toBe("one");
      expectUnchanged(before, time);
      expect(audioElement.currentTime).toBe(time);

      await userEvent.keyboard(" ");
      await expect.poll(() => useProjectStore.getState().lines[0].words?.[0].begin).toBe(time);
      expect(audioElement.currentTime).toBe(time);
    },
  );

  it.each(["timeline", "edit"] as const)("preserves seeker keyboard controls in %s mode", async (mode) => {
    load([createLine({ text: "one two" })]);
    const { screen, seeker, audioElement } = await renderWithSeeker();
    if (mode === "edit") {
      await screen.getByRole("button", { name: "Edit", exact: true }).click();
      await seeker.click();
    } else {
      flushSync(() => useProjectStore.setState({ activeTab: "timeline" }));
    }
    const time = audioElement.currentTime;
    const before = useProjectStore.getState();
    const playing = useAudioStore.getState().isPlaying;

    await userEvent.keyboard("{ArrowUp}");
    expect(useAudioStore.getState().currentTime).toBe(time + 1);
    expect(audioElement.currentTime).toBe(time + 1);
    await userEvent.keyboard("{ArrowDown}");
    expect(useAudioStore.getState().currentTime).toBe(time);
    expect(audioElement.currentTime).toBe(time);
    expect(useProjectStore.getState().lines).toBe(before.lines);
    expect(useProjectStore.getState().history).toBe(before.history);
    expect(useAudioStore.getState().isPlaying).toBe(playing);
  });

  it("prioritizes rebound navigation keys over the seeker while leaving unbound arrows available", async () => {
    useShortcutBindingsStore.setState({
      overrides: {
        "sync.nextWord": { key: "PageUp" },
        "sync.previousWord": { key: "PageDown" },
      },
    });
    load([createLine({ text: "one two three" })]);
    const { screen, audioElement } = await renderWithSeeker();
    const time = audioElement.currentTime;
    const before = useProjectStore.getState();

    await userEvent.keyboard("{PageUp}");
    await expect.poll(() => selectedWord(screen.container)).toBe("two");
    expectUnchanged(before, time);
    expect(audioElement.currentTime).toBe(time);
    await userEvent.keyboard("{PageDown}");
    await expect.poll(() => selectedWord(screen.container)).toBe("one");
    expectUnchanged(before, time);
    expect(audioElement.currentTime).toBe(time);

    await userEvent.keyboard("{ArrowUp}");
    expect(useAudioStore.getState().currentTime).toBe(time + 1);
    expect(audioElement.currentTime).toBe(time + 1);
    expect(selectedWord(screen.container)).toBe("one");
  });

  it("moves through untimed words and across blank lines without any project or playback writes", async () => {
    load([
      createLine({ id: "l0", text: "one two" }),
      createLine({ id: "blank", text: "" }),
      createLine({ id: "l2", text: "three four" }),
    ]);
    const screen = await render(<SyncPanel />);
    const before = useProjectStore.getState();

    expect(press("ArrowUp").defaultPrevented).toBe(true);
    await expect.poll(() => selectedWord(screen.container)).toBe("two");
    press("ArrowUp");
    await expect.poll(() => selectedWord(screen.container)).toBe("three");
    press("ArrowDown");
    await expect.poll(() => selectedWord(screen.container)).toBe("two");
    press("ArrowDown");
    await expect.poll(() => selectedWord(screen.container)).toBe("one");
    expectUnchanged(before);
  });

  it("applies rapid key presses in order and ignores auto-repeat", async () => {
    load([createLine({ text: "one two three four" })]);
    const screen = await render(<SyncPanel />);
    press("ArrowUp");
    press("ArrowUp");
    await expect.poll(() => selectedWord(screen.container)).toBe("three");
    press("ArrowUp", { repeat: true });
    press("ArrowDown", { repeat: true });
    press("ArrowDown");
    await expect.poll(() => selectedWord(screen.container)).toBe("two");
  });

  it.each([
    { key: "ArrowUp", startingWord: "one", selectedIndex: 2, nextWord: "four" },
    { key: "ArrowDown", startingWord: "four", selectedIndex: 1, nextWord: "three" },
  ])(
    "syncs the latest selection when $key and Space arrive together",
    async ({ key, startingWord, selectedIndex, nextWord }) => {
      load([
        createLine({
          text: "one two three four",
          words: [
            { text: "one ", begin: 1, end: 2 },
            { text: "two ", begin: 2, end: 3 },
            { text: "three ", begin: 3, end: 4 },
            { text: "four", begin: 4, end: 5 },
          ],
        }),
      ]);
      const screen = await render(<SyncPanel />);
      if (startingWord === "four") {
        press("ArrowUp");
        press("ArrowUp");
        press("ArrowUp");
      }
      await expect.poll(() => selectedWord(screen.container)).toBe(startingWord);
      setCurrentTime(6);
      const before = useProjectStore.getState();
      press(key);
      press(key);
      expectUnchanged(before, 6);
      press(" ");

      await expect.poll(() => selectedWord(screen.container)).toBe(nextWord);
      expect(useProjectStore.getState().lines[0].words?.[selectedIndex].begin).toBe(6);
      expect(useProjectStore.getState().lines[0].words?.[0].begin).toBe(1);
      expect(useAudioStore.getState().currentTime).toBe(6);
      flushSync(() => useProjectStore.getState().undo());
      expect(useProjectStore.getState().lines).toEqual(before.lines);
    },
  );

  it.each(["word", "line"] as const)("syncs a newly selected line immediately in %s mode", async (granularity) => {
    load(
      [
        createLine({ text: "one" }),
        createLine({ text: "" }),
        createLine({ text: "two" }),
        createLine({ text: "three" }),
        createLine({ text: "four" }),
      ],
      granularity,
    );
    const screen = await render(<SyncPanel />);
    setCurrentTime(6);
    const before = useProjectStore.getState();
    press("ArrowUp");
    press("ArrowUp");
    expectUnchanged(before, 6);
    press(" ");

    await expect.poll(() => selectedWord(screen.container)).toBe("four");
    const recordedLine = useProjectStore.getState().lines[3];
    expect(granularity === "word" ? recordedLine.words?.[0].begin : recordedLine.begin).toBe(6);
    expect(useProjectStore.getState().lines.slice(0, 3)).toEqual(before.lines.slice(0, 3));
  });

  it("starts a hold on the newly selected word without waiting for a render", async () => {
    load([createLine({ text: "one two three" })]);
    const screen = await render(<SyncPanel />);
    setCurrentTime(1);
    press(" ");
    await expect.poll(() => selectedWord(screen.container)).toBe("two");
    setCurrentTime(2);
    press("ArrowDown");
    press("f", { code: "KeyF" });

    await expect.poll(() => selectedWord(screen.container)).toBe("one");
    expect(useProjectStore.getState().lines[0].words).toEqual([{ text: "one ", begin: 2, end: 2 }]);
    setCurrentTime(3);
    press("f", { code: "KeyF" }, "keyup");
    await expect.poll(() => selectedWord(screen.container)).toBe("two");
    expect(useProjectStore.getState().lines[0].words).toEqual([{ text: "one ", begin: 2, end: 3 }]);
  });

  it("keeps the existing protection against creating timing gaps when Space follows an untimed selection", async () => {
    load([createLine({ text: "one two three" })]);
    const screen = await render(<SyncPanel />);
    const before = useProjectStore.getState();
    press("ArrowUp");
    await expect.poll(() => selectedWord(screen.container)).toBe("two");
    press(" ");
    await expect.poll(() => selectedWord(screen.container)).toBe("two");
    expectUnchanged(before);
  });

  it("stops at the lyric boundaries", async () => {
    load([createLine({ text: "one two" })]);
    const screen = await render(<SyncPanel />);
    press("ArrowDown");
    await expect.poll(() => selectedWord(screen.container)).toBe("one");
    press("ArrowUp");
    await expect.poll(() => selectedWord(screen.container)).toBe("two");
    press("ArrowUp");
    await expect.poll(() => selectedWord(screen.container)).toBe("two");
  });

  it("re-syncs the selected word only when Space is pressed, then resumes normal advancement", async () => {
    load([createLine({ id: "l0", text: "one two three" })]);
    const screen = await render(<SyncPanel />);
    setCurrentTime(1);
    press(" ");
    await expect.poll(() => selectedWord(screen.container)).toBe("two");
    setCurrentTime(2);
    press(" ");
    await expect.poll(() => selectedWord(screen.container)).toBe("three");
    const before = useProjectStore.getState();

    press("ArrowDown");
    await expect.poll(() => selectedWord(screen.container)).toBe("two");
    expectUnchanged(before, 2);

    setCurrentTime(1.6);
    press(" ");
    await expect.poll(() => useProjectStore.getState().lines[0].words?.[1].begin).toBe(1.6);
    expect(useProjectStore.getState().lines[0].words?.map((word) => word.text)).toEqual(["one ", "two "]);
    expect(useProjectStore.getState().history.length).toBe(before.history.length + 1);
    await expect.poll(() => selectedWord(screen.container)).toBe("three");
  });

  it("preserves the remaining timings while re-syncing after seeking back over deliberately early taps", async () => {
    load([createLine({ id: "l0", text: "the light scars stay" })]);
    const { screen, audioElement } = await renderWithSeeker();
    for (const time of [0.5, 0.8, 0.9, 1]) {
      flushSync(() => useAudioStore.getState().seekTo(time));
      await userEvent.keyboard(" ");
      await expect.poll(() => useProjectStore.getState().lines[0].words?.at(-1)?.begin).toBe(time);
    }
    await expect.element(screen.getByText("Sync complete!")).toBeVisible();
    const original = useProjectStore.getState().lines[0].words ?? [];

    // Return to light, then seek back from a later point to its corrected playback position.
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    await expect.poll(() => selectedWord(screen.container)).toBe("light");
    flushSync(() => useAudioStore.getState().seekTo(5.606));
    const beforeSeek = useProjectStore.getState();
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}");
    expect(audioElement.currentTime).toBeCloseTo(2.606);
    expect(useProjectStore.getState().lines).toBe(beforeSeek.lines);
    expect(useProjectStore.getState().history).toBe(beforeSeek.history);
    await userEvent.keyboard(" ");
    await expect.poll(() => useProjectStore.getState().lines[0].words?.[1].begin).toBeCloseTo(2.606);
    expect(useProjectStore.getState().lines[0].words?.slice(2)).toEqual(original.slice(2));

    flushSync(() => useAudioStore.getState().seekTo(3.1));
    await userEvent.keyboard(" ");
    await expect.poll(() => selectedWord(screen.container)).toBe("stay");
    expect(useProjectStore.getState().lines[0].words?.[3]).toEqual(original[3]);
    flushSync(() => useAudioStore.getState().seekTo(3.7));
    await userEvent.keyboard(" ");
    await expect.element(screen.getByText("Sync complete!")).toBeVisible();
    const words = useProjectStore.getState().lines[0].words ?? [];
    for (const [index, time] of [0.5, 2.606, 3.1, 3.7].entries()) expect(words[index].begin).toBeCloseTo(time);
    for (const word of words) expect(word.end).toBeGreaterThan(word.begin);
    await screen.getByRole("button", { name: "Edit", exact: true }).click();
    expect(screen.container.querySelector(".text-composer-warning")).toBeNull();
  });

  it("continues a keyboard re-sync pass across lines without collapsing untapped words", async () => {
    load([
      createLine({ id: "l0", text: "one", words: [{ text: "one", begin: 1, end: 2 }] }),
      createLine({ id: "blank", text: "" }),
      createLine({
        id: "l2",
        text: "two three",
        words: [
          { text: "two ", begin: 2, end: 3 },
          { text: "three", begin: 3, end: 4 },
        ],
      }),
    ]);
    const screen = await render(<SyncPanel />);
    press("ArrowUp");
    press("ArrowDown");
    await expect.poll(() => selectedWord(screen.container)).toBe("one");
    setCurrentTime(5);
    press(" ");
    await expect.poll(() => selectedWord(screen.container)).toBe("two");
    const last = useProjectStore.getState().lines[2].words?.[1];
    setCurrentTime(6);
    press(" ");
    await expect.poll(() => selectedWord(screen.container)).toBe("three");
    expect(useProjectStore.getState().lines[2].words?.[1]).toEqual(last);
    setCurrentTime(7);
    press(" ");
    await expect.element(screen.getByText("Sync complete!")).toBeVisible();
    expect(useProjectStore.getState().lines[0].words?.[0]).toEqual({ text: "one", begin: 5, end: 6 });
    expect(useProjectStore.getState().lines[2].words).toEqual([
      { text: "two ", begin: 6, end: 7 },
      { text: "three", begin: 7, end: 7.3 },
    ]);
  });

  it("seeks with left and right arrows on the focused seeker without also nudging word timings", async () => {
    load([createLine({ id: "l0", text: "one two three" })]);
    const { screen, seeker, audioElement } = await renderWithSeeker();
    flushSync(() => useAudioStore.getState().seekTo(1));
    await userEvent.keyboard(" ");
    await expect.poll(() => selectedWord(screen.container)).toBe("two");
    const before = useProjectStore.getState();

    await userEvent.keyboard("{ArrowLeft}");
    expect(audioElement.currentTime).toBe(0);
    expect(useProjectStore.getState().lines).toBe(before.lines);
    expect(useProjectStore.getState().history).toBe(before.history);
    await userEvent.keyboard("{ArrowRight}");
    expect(audioElement.currentTime).toBe(1);
    expect(useProjectStore.getState().lines).toBe(before.lines);
    expect(useProjectStore.getState().history).toBe(before.history);
    expect(document.activeElement).toBe(seeker.element());
  });

  it("selects a later timed word and uses the existing resync logic without stretching the previous word", async () => {
    load([
      createLine({
        text: "one two three",
        words: [
          { text: "one ", begin: 1, end: 2 },
          { text: "two ", begin: 5, end: 6 },
          { text: "three", begin: 9, end: 10 },
        ],
      }),
    ]);
    const screen = await render(<SyncPanel />);
    const before = useProjectStore.getState();
    press("ArrowUp");
    press("ArrowUp");
    await expect.poll(() => selectedWord(screen.container)).toBe("three");
    expectUnchanged(before);

    setCurrentTime(8);
    press(" ");
    await expect.poll(() => useProjectStore.getState().lines[0].words?.[2].begin).toBe(8);
    expect(useProjectStore.getState().lines[0].words?.[1]).toEqual(before.lines[0].words?.[1]);
  });

  it("can return from sync completion to correct the last word", async () => {
    load([createLine({ text: "one" })]);
    const screen = await render(<SyncPanel />);
    setCurrentTime(1);
    press(" ");
    await expect.element(screen.getByText("Sync complete!")).toBeVisible();
    const before = useProjectStore.getState();
    press("ArrowDown");
    await expect.poll(() => selectedWord(screen.container)).toBe("one");
    expectUnchanged(before, 1);
    setCurrentTime(2);
    press(" ");
    await expect.poll(() => useProjectStore.getState().lines[0].words?.[0].begin).toBe(2);
  });

  it("moves one line in line mode and re-syncs that line on Space", async () => {
    load(
      [
        createLine({ id: "l0", text: "first line", begin: 1, end: 2 }),
        createLine({ id: "blank", text: "" }),
        createLine({ id: "l2", text: "second line", begin: 5, end: 6 }),
      ],
      "line",
    );
    const screen = await render(<SyncPanel />);
    const before = useProjectStore.getState();
    press("ArrowUp");
    await expect.poll(() => selectedWord(screen.container)).toBe("second");
    press("ArrowDown");
    await expect.poll(() => selectedWord(screen.container)).toBe("first");
    press("ArrowUp");
    await expect.poll(() => selectedWord(screen.container)).toBe("second");
    expectUnchanged(before);
    setCurrentTime(4);
    press(" ");
    await expect.poll(() => useProjectStore.getState().lines[2].begin).toBe(4);
    expect(useProjectStore.getState().lines[0]).toEqual(before.lines[0]);
  });

  it("respects custom shortcut bindings", async () => {
    useShortcutBindingsStore.setState({
      overrides: {
        "sync.nextWord": { key: "k" },
        "sync.previousWord": { key: "j" },
      },
    });
    load([createLine({ text: "one two three" })]);
    const screen = await render(<SyncPanel />);
    press("ArrowUp");
    press("k");
    await expect.poll(() => selectedWord(screen.container)).toBe("two");
    press("ArrowDown");
    press("j");
    await expect.poll(() => selectedWord(screen.container)).toBe("one");
  });

  it("ignores navigation outside the sync tab, while a modal is open, and in edit mode", async () => {
    load([createLine({ text: "one two three" })]);
    const screen = await render(<SyncPanel />);
    flushSync(() => useProjectStore.setState({ activeTab: "timeline" }));
    expect(press("ArrowUp").defaultPrevented).toBe(false);
    flushSync(() => useProjectStore.setState({ activeTab: "sync" }));
    useModalStackStore.setState({ count: 1 });
    expect(press("ArrowUp").defaultPrevented).toBe(false);
    useModalStackStore.setState({ count: 0 });
    await screen.getByRole("button", { name: "Edit", exact: true }).click();
    press("ArrowUp");
    await screen.getByRole("button", { name: "Done", exact: true }).click();
    useAudioStore.setState({ isPlaying: true });
    await expect.poll(() => selectedWord(screen.container)).toBe("one");
  });

  it("leaves an active hold on its original word until release", async () => {
    load([createLine({ text: "one two three" })]);
    const screen = await render(<SyncPanel />);
    setCurrentTime(1);
    press("f", { code: "KeyF" });
    await expect.poll(() => useProjectStore.getState().lines[0].words?.[0].begin).toBe(1);
    const before = useProjectStore.getState();
    press("ArrowUp");
    press("ArrowDown");
    expectUnchanged(before, 1);
    setCurrentTime(2);
    press("f", { code: "KeyF" }, "keyup");
    await expect.poll(() => useProjectStore.getState().lines[0].words?.[0].end).toBe(2);
    await expect.poll(() => selectedWord(screen.container)).toBe("two");
  });
});
