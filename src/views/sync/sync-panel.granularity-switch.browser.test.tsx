import { isLineSynced, isWordSynced } from "@/domain/line/predicates";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { setCurrentTime } from "@/test/sync-gesture-helpers";
import { SyncPanel } from "@/views/sync/sync-panel";
import { beforeEach, describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const lineSynced = createLine({ id: "line-synced", text: "Hello world", begin: 1, end: 3 });
const wordSynced = createLine({
  id: "word-synced",
  text: "Good night",
  words: [
    { text: "Good ", begin: 4, end: 5 },
    { text: "night", begin: 5, end: 6 },
  ],
});
const untimed = createLine({ id: "untimed", text: "Not yet" });

function loadMixedProject(): void {
  useAudioStore.setState({ source: { type: "file", file: createAudioFile() }, duration: 10, currentTime: 0 });
  useProjectStore.setState({
    activeTab: "sync",
    granularity: "line",
    lines: [lineSynced, wordSynced, untimed],
  });
}

beforeEach(() => {
  useSettingsStore.setState({ syncCountIn: 0 });
});

// -- Tests --------------------------------------------------------------------

describe("SyncPanel granularity switch", () => {
  describe("regressions", () => {
    it("regression #290: switching to Word keeps line-synced lines line-synced", async () => {
      loadMixedProject();
      const screen = await render(<SyncPanel />);

      await screen.getByRole("button", { name: "Word" }).click();

      await expect.poll(() => useProjectStore.getState().granularity).toBe("word");
      const synced = useProjectStore.getState().lines.find((line) => line.id === "line-synced");
      expect(synced && isLineSynced(synced)).toBe(true);
      expect(synced).toMatchObject({ begin: 1, end: 3 });
      expect(synced?.words).toBeUndefined();
    });
  });

  describe("display", () => {
    it("shows a line-synced line as one timed line in Word mode", async () => {
      loadMixedProject();
      const screen = await render(<SyncPanel />);

      await screen.getByRole("button", { name: "Word" }).click();
      await screen.getByRole("button", { name: "Edit" }).click();

      await expect.element(screen.getByText("Hello world", { exact: true }).first()).toBeInTheDocument();
      await expect.element(screen.getByText("Good", { exact: true }).first()).toBeInTheDocument();
      await expect.element(screen.getByText("night", { exact: true }).first()).toBeInTheDocument();
    });

    it("still splits an untimed line into word slots in Word mode", async () => {
      loadMixedProject();
      const screen = await render(<SyncPanel />);

      await screen.getByRole("button", { name: "Word" }).click();

      await expect.element(screen.getByText("Not", { exact: true })).toBeInTheDocument();
      await expect.element(screen.getByText("yet", { exact: true })).toBeInTheDocument();
    });
  });

  describe("word sync on a line-synced line", () => {
    it("a Word-mode tap starts word-syncing only that line, and undo restores its line timing", async () => {
      useAudioStore.setState({
        source: { type: "file", file: createAudioFile() },
        duration: 10,
        currentTime: 0,
        isPlaying: true,
      });
      useProjectStore.setState({ activeTab: "sync", granularity: "word", lines: [lineSynced, untimed] });
      const screen = await render(<SyncPanel />);
      await expect.element(screen.getByRole("group", { name: "Timing granularity" })).toBeInTheDocument();

      setCurrentTime(1.5);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true }));

      await expect.poll(() => useProjectStore.getState().lines[0].words?.map((word) => word.text)).toEqual(["Hello "]);
      const [tapped, next] = useProjectStore.getState().lines;
      expect(tapped.words?.[0].begin).toBe(1.5);
      expect(isLineSynced(tapped)).toBe(false);
      expect(next).toBe(untimed);

      useProjectStore.getState().undo();

      const restored = useProjectStore.getState().lines[0];
      expect(isLineSynced(restored)).toBe(true);
      expect(restored).toMatchObject({ begin: 1, end: 3 });
    });
  });

  describe("invariants", () => {
    it("switching granularity never writes lines or history", async () => {
      loadMixedProject();
      const linesBefore = useProjectStore.getState().lines;
      const historyBefore = useProjectStore.getState().history;
      const screen = await render(<SyncPanel />);

      await screen.getByRole("button", { name: "Word" }).click();
      await expect.poll(() => useProjectStore.getState().granularity).toBe("word");
      await screen.getByRole("button", { name: "Line" }).click();
      await expect.poll(() => useProjectStore.getState().granularity).toBe("line");

      expect(useProjectStore.getState().lines).toBe(linesBefore);
      expect(useProjectStore.getState().history).toBe(historyBefore);
    });

    it("leaves word-synced and untimed lines as they were", async () => {
      loadMixedProject();
      const screen = await render(<SyncPanel />);

      await screen.getByRole("button", { name: "Word" }).click();
      await expect.poll(() => useProjectStore.getState().granularity).toBe("word");

      const [, word, plain] = useProjectStore.getState().lines;
      expect(isWordSynced(word)).toBe(true);
      expect(word.words).toEqual(wordSynced.words);
      expect(plain.words).toBeUndefined();
      expect(plain.begin).toBeUndefined();
    });
  });
});
