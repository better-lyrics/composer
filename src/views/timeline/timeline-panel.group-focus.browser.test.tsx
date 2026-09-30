import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { createGroup, createLine, createWord } from "@/test/factories";
import { stepFrames } from "@/test/frame-steps";
import { render } from "@/test/render";
import { isMac } from "@/utils/platform";
import { FOCUS_SCROLL_MARGIN_PX } from "@/views/timeline/group-focus";
import { TimelinePanel } from "@/views/timeline/timeline-panel";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { getWordsInInstance } from "@/views/timeline/utils";
import { beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Fixtures -----------------------------------------------------------------

const chorus = (instanceIdx: number, begin: number) =>
  createLine({
    id: `c${instanceIdx}`,
    text: "go now",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: [
      createWord({ text: "go ", begin, end: begin + 1 }),
      createWord({ text: "now", begin: begin + 1, end: begin + 2 }),
    ],
  });

const verse = createLine({ id: "v", text: "verse", words: [createWord({ text: "verse", begin: 20, end: 21 })] });

function seed() {
  useAudioStore.setState({ source: { type: "file", file: createAudioFile() }, duration: 120 });
  useProjectStore.setState({
    activeTab: "timeline",
    groups: [createGroup({ id: "g1", label: "Chorus", sharesTiming: true, ownTimingInstances: [2] })],
    lines: [chorus(0, 10), verse, chorus(1, 40), chorus(2, 70)],
  });
  useProjectStore.getState().clearHistory();
}

const PlayableTimeline: React.FC = () => {
  useGlobalShortcuts({ setActiveTab: () => {}, setHelpOpen: () => {}, setSettingsOpen: () => {} });
  return <TimelinePanel />;
};

const focus = () => useTimelineStore.getState().focusedGroup;
const store = () => useProjectStore.getState();
const lineById = (id: string) => store().lines.find((line) => line.id === id);

function shownLineIndices(): number[] {
  return [...document.querySelectorAll<HTMLElement>('[data-track="word"]')].map((el) => Number(el.dataset.lineIndex));
}

function banner(instanceIdx: number): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-instance-key="g1:${instanceIdx}"]`);
  if (!el) throw new Error(`banner ${instanceIdx} not rendered`);
  return el;
}

function press(key: string, init: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
}

function pressSelectAll() {
  press("a", { code: "KeyA", metaKey: isMac, ctrlKey: !isMac });
}

async function renderOpen(instanceIdx: number) {
  const screen = await render(<TimelinePanel />);
  await expect.poll(() => document.querySelectorAll("[data-instance-key]").length).toBe(3);
  await userEvent.dblClick(banner(instanceIdx));
  await expect.poll(() => focus()?.hearInstanceIdx).toBe(instanceIdx);
  return screen;
}

beforeEach(seed);

// -- Tests --------------------------------------------------------------------

describe("TimelinePanel · group focus", () => {
  it("opens the group on a banner double-click and shows only that instance", async () => {
    const screen = await renderOpen(1);

    await expect.poll(shownLineIndices).toEqual([2]);
    expect(document.querySelectorAll("[data-group-header]")).toHaveLength(0);
    await expect.element(screen.getByRole("group", { name: "Hear" })).toBeVisible();
  });

  it("opens only the own-timing instance, with Share timing in the bar", async () => {
    const screen = await renderOpen(2);

    await expect.poll(shownLineIndices).toEqual([3]);
    await expect.element(screen.getByRole("group", { name: "Hear" })).not.toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Share timing" })).toBeVisible();
  });

  it("switches the shown rows with the Hear switch", async () => {
    const screen = await renderOpen(0);
    await expect.poll(shownLineIndices).toEqual([0]);

    await screen.getByRole("button", { name: "Chorus 2" }).click();

    await expect.poll(shownLineIndices).toEqual([2]);
  });

  it("returns to the song from the Song crumb", async () => {
    const screen = await renderOpen(0);

    await screen.getByRole("button", { name: "Song" }).click();

    await expect.poll(shownLineIndices).toEqual([0, 1, 2, 3]);
    expect(document.querySelectorAll("[data-group-header]")).toHaveLength(3);
  });

  it("applies an edit in the open group to every placed shared instance", async () => {
    await renderOpen(1);
    pressSelectAll();
    await expect.poll(() => useTimelineStore.getState().selectedWords).toHaveLength(2);

    press("ArrowRight");

    await expect.poll(() => lineById("c1")?.words?.[0].begin).toBeGreaterThan(40);
    const delta = (lineById("c1")?.words?.[0].begin ?? 0) - 40;
    expect(lineById("c0")?.words?.[0].begin).toBeCloseTo(10 + delta);
    expect(lineById("c2")?.words?.[0].begin).toBe(70);
    expect(lineById("v")?.words?.[0].begin).toBe(20);
  });

  describe("keyboard", () => {
    it("opens the group with Shift+Enter on a selected banner, without toggling playback", async () => {
      await render(<PlayableTimeline />);
      useTimelineStore.getState().setSelectedWords(getWordsInInstance(store().lines, "g1", 1));

      await userEvent.keyboard("{Shift>}{Enter}{/Shift}");

      await expect.poll(() => focus()).toEqual({ groupId: "g1", hearInstanceIdx: 1 });
      expect(useAudioStore.getState().isPlaying).toBe(false);
    });

    it("opens the group with Shift+Enter on a focused banner label", async () => {
      await render(<TimelinePanel />);
      await expect.poll(() => document.querySelectorAll("[data-group-header]").length).toBe(3);
      document.querySelector<HTMLButtonElement>('[data-group-header="g1:2"] button')?.focus();

      await userEvent.keyboard("{Shift>}{Enter}{/Shift}");

      await expect.poll(() => focus()).toEqual({ groupId: "g1", hearInstanceIdx: 2 });
      expect(useTimelineStore.getState().contextMenu).toBeNull();
    });

    it("leaves Enter to play and pause even with a banner selected", async () => {
      await render(<PlayableTimeline />);
      useTimelineStore.getState().setSelectedWords(getWordsInInstance(store().lines, "g1", 1));

      await userEvent.keyboard("{Enter}");

      await expect.poll(() => useAudioStore.getState().isPlaying).toBe(true);
      expect(focus()).toBeNull();
    });

    it("leaves Enter to play and pause when no banner is selected", async () => {
      await render(<PlayableTimeline />);
      useTimelineStore.getState().setSelectedWords([{ lineId: "c1", lineIndex: 2, wordIndex: 0, type: "word" }]);

      await userEvent.keyboard("{Enter}");

      await expect.poll(() => useAudioStore.getState().isPlaying).toBe(true);
      expect(focus()).toBeNull();
    });

    it("closes the group with Escape", async () => {
      await renderOpen(0);

      await userEvent.keyboard("{Escape}");

      await expect.poll(() => focus()).toBeNull();
      await expect.poll(shownLineIndices).toEqual([0, 1, 2, 3]);
    });

    it("clears the selection with the first Escape and closes the group with the second", async () => {
      await renderOpen(0);
      pressSelectAll();
      await expect.poll(() => useTimelineStore.getState().selectedWords).toHaveLength(2);

      await userEvent.keyboard("{Escape}");
      await expect.poll(() => useTimelineStore.getState().selectedWords).toEqual([]);
      expect(focus()).not.toBeNull();

      await userEvent.keyboard("{Escape}");
      await expect.poll(() => focus()).toBeNull();
    });

    it("closes an open menu before the group", async () => {
      await renderOpen(0);
      useTimelineStore.getState().setContextMenu({
        x: 10,
        y: 10,
        target: { kind: "gutter", lineId: "c0", lineIndex: 0 },
      });
      await expect.poll(() => document.querySelector(".layer-floating")).not.toBeNull();

      await userEvent.keyboard("{Escape}");

      await expect.poll(() => useTimelineStore.getState().contextMenu).toBeNull();
      expect(focus()).not.toBeNull();
    });

    it("selects nothing under the playhead outside the open instance", async () => {
      await renderOpen(1);
      useAudioStore.setState({ currentTime: 20.5 });

      press("a", { code: "KeyA" });

      expect(useTimelineStore.getState().selectedWords).toEqual([]);
    });

    it("selects the open instance's word under the playhead", async () => {
      await renderOpen(1);
      useAudioStore.setState({ currentTime: 40.5 });

      press("a", { code: "KeyA" });

      await expect.poll(() => useTimelineStore.getState().selectedWords.map((word) => word.lineId)).toEqual(["c1"]);
    });

    it("sets a word begin from the playhead only inside the open instance", async () => {
      await renderOpen(1);
      useAudioStore.setState({ currentTime: 15 });

      press("[", { code: "BracketLeft" });

      await expect.poll(() => lineById("c1")?.words?.[0].begin).not.toBe(40);
      expect(lineById("v")?.words?.[0].begin).toBe(20);
    });

    it("selects only the open instance with select all", async () => {
      await renderOpen(1);

      pressSelectAll();

      await expect
        .poll(() => useTimelineStore.getState().selectedWords.map((word) => word.lineId))
        .toEqual(["c1", "c1"]);
    });
  });

  describe("scroll", () => {
    it("scrolls to the heard instance and keeps the scroll inside it", async () => {
      useTimelineStore.setState({ zoom: 50 });
      await renderOpen(1);
      const container = document.querySelector<HTMLDivElement>("[data-scroll-container]");
      if (!container) throw new Error("no scroll container");

      await expect.poll(() => container.scrollLeft).toBeGreaterThan(40 * 50 - 100);
      container.scrollLeft = 0;

      await expect.poll(() => container.scrollLeft).toBeGreaterThan(40 * 50 - 100);
    });

    it("keeps the follow scroll inside the heard instance while playing elsewhere", async () => {
      useTimelineStore.setState({ zoom: 50, followEnabled: true });
      await renderOpen(1);
      const container = document.querySelector<HTMLDivElement>("[data-scroll-container]");
      if (!container) throw new Error("no scroll container");
      await expect.poll(() => container.scrollLeft).toBeGreaterThan(40 * 50 - 100);

      useAudioStore.setState({ currentTime: 20, isPlaying: true });
      const samples: number[] = [];
      for (let frame = 0; frame < 10; frame++) {
        await stepFrames(1);
        samples.push(container.scrollLeft);
      }

      expect(Math.min(...samples)).toBeGreaterThanOrEqual(40 * 50 - FOCUS_SCROLL_MARGIN_PX - 1);
    });
  });

  describe("regressions", () => {
    it("regression: opens a line-synced instance with Shift+Enter after a banner click", async () => {
      const lineSynced = (instanceIdx: number, begin: number) =>
        createLine({
          id: `s${instanceIdx}`,
          text: "go now",
          groupId: "g1",
          instanceIdx,
          templateLineIdx: 0,
          begin,
          end: begin + 2,
        });
      useProjectStore.setState({ lines: [lineSynced(0, 10), verse, lineSynced(1, 40)] });
      await render(<PlayableTimeline />);
      await expect.poll(() => document.querySelectorAll("[data-instance-key]").length).toBe(2);

      await userEvent.click(banner(1));
      await expect.poll(() => useTimelineStore.getState().selectedWords.map((word) => word.lineId)).toEqual(["s1"]);
      await userEvent.keyboard("{Shift>}{Enter}{/Shift}");

      await expect.poll(() => focus()).toEqual({ groupId: "g1", hearInstanceIdx: 1 });
    });

    it("regression: a double-click on the group label still renames the group", async () => {
      const screen = await render(<TimelinePanel />);
      await expect.poll(() => document.querySelectorAll("[data-group-header]").length).toBe(3);
      const label = document.querySelector<HTMLElement>('[data-group-header="g1:0"] button');
      if (!label) throw new Error("group label not rendered");

      await userEvent.dblClick(label);

      await expect.element(screen.getByRole("textbox", { name: "Group name" })).toBeVisible();
      expect(focus()).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("shows the whole song when the open instance goes away", async () => {
      await renderOpen(1);

      useProjectStore.setState({ lines: [chorus(0, 10), verse] });

      await expect.poll(shownLineIndices).toEqual([0, 1]);
      expect(document.querySelectorAll("[data-group-header]")).toHaveLength(1);
      expect(document.querySelector("[data-group-focus-bar]")).toBeNull();
    });

    it("opens another group with Shift+Enter after the open instance goes away", async () => {
      await renderOpen(1);
      useProjectStore.setState({ lines: [chorus(0, 10), verse] });
      await expect.poll(shownLineIndices).toEqual([0, 1]);
      useTimelineStore.getState().setSelectedWords(getWordsInInstance(store().lines, "g1", 0));

      await userEvent.keyboard("{Shift>}{Enter}{/Shift}");

      await expect.poll(() => focus()).toEqual({ groupId: "g1", hearInstanceIdx: 0 });
    });
  });
});
