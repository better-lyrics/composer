import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import {
  banner,
  chorus,
  focus,
  lineById,
  press,
  pressSelectAll,
  renderOpen,
  seedGroupFocusSong,
  shownLineIndices,
  store,
  verse,
} from "@/views/timeline/group-focus.test-helpers";
import { PlayableTimeline } from "@/views/timeline/group-focus.test-timeline";
import { TimelinePanel } from "@/views/timeline/timeline-panel";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { getWordsInInstance } from "@/views/timeline/utils";
import { Toaster } from "sonner";
import { beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

beforeEach(seedGroupFocusSong);

// -- Tests --------------------------------------------------------------------

describe("TimelinePanel · group focus", () => {
  it("opens the group on a banner double-click and shows only that instance", async () => {
    const screen = await renderOpen(1);

    await expect.poll(shownLineIndices).toEqual([2]);
    expect(document.querySelectorAll("[data-group-header]")).toHaveLength(0);
    await expect.element(screen.getByRole("button", { name: "Next instance" })).toBeVisible();
  });

  it("opens only the own-timing instance, with Share timing in the bar", async () => {
    const screen = await renderOpen(2);

    await expect.poll(shownLineIndices).toEqual([3]);
    await expect.element(screen.getByRole("button", { name: "Next instance" })).not.toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Share timing" })).toBeVisible();
  });

  it("switches the shown rows with the instance stepper", async () => {
    const screen = await renderOpen(0);
    await expect.poll(shownLineIndices).toEqual([0]);

    await screen.getByRole("button", { name: "Next instance" }).click();

    await expect.poll(shownLineIndices).toEqual([2]);
  });

  it("moves the playhead to the same moment in the instance chosen with the stepper", async () => {
    const screen = await renderOpen(0);
    useAudioStore.getState().seekTo(10.5);

    await screen.getByRole("button", { name: "Next instance" }).click();

    await expect.poll(() => useAudioStore.getState().currentTime).toBeCloseTo(40.5);
  });

  it("returns to the song with Done", async () => {
    const screen = await renderOpen(0);

    await screen.getByRole("button", { name: /^Done/ }).click();

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

  it("says why a shared nudge stops where another instance reaches the song end", async () => {
    useAudioStore.setState({ duration: 42.02 });
    const screen = await render(
      <>
        <PlayableTimeline />
        <Toaster />
      </>,
    );
    useTimelineStore.getState().setSelectedWords(getWordsInInstance(store().lines, "g1", 0));

    press("ArrowRight");

    await expect.element(screen.getByText("Stopped where a shared instance reaches the song edge")).toBeVisible();
  });

  it("edge case: stays quiet when the song end itself stops a nudge", async () => {
    useAudioStore.setState({ duration: 21.02 });
    const screen = await render(
      <>
        <PlayableTimeline />
        <Toaster />
      </>,
    );
    useTimelineStore.getState().setSelectedWords([{ lineId: "v", lineIndex: 1, wordIndex: 0, type: "word" }]);

    press("ArrowRight");

    await expect.poll(() => lineById("v")?.words?.[0].end).toBeCloseTo(21.02);
    expect(screen.container.ownerDocument.body.textContent).not.toContain("Stopped where");
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

    it("selects only the open instance with select all", async () => {
      await renderOpen(1);

      pressSelectAll();

      await expect
        .poll(() => useTimelineStore.getState().selectedWords.map((word) => word.lineId))
        .toEqual(["c1", "c1"]);
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
