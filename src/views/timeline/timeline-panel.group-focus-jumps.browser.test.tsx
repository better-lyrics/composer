import { useProjectStore } from "@/stores/project";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { FOCUS_SCROLL_MARGIN_PX } from "@/views/timeline/group-focus";
import {
  chorus,
  focus,
  pressMod,
  renderOpen,
  scrollContainer,
  seedGroupFocusSong,
  selectedLineIds,
  verse,
} from "@/views/timeline/group-focus.test-helpers";
import { TimelinePanel } from "@/views/timeline/timeline-panel";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { getWordsInInstance } from "@/views/timeline/utils";
import { beforeEach, describe, expect, it } from "vitest";

const pressNextInstance = () => pressMod("k", "KeyK");
const pressPrevInstance = () => pressMod("j", "KeyJ");

beforeEach(seedGroupFocusSong);

// -- Tests --------------------------------------------------------------------

describe("TimelinePanel · instance jumps in an open group", () => {
  it("hears the next shared instance, skipping the own-timing one", async () => {
    await renderOpen(1);

    pressNextInstance();

    await expect.poll(() => focus()).toEqual({ groupId: "g1", hearInstanceIdx: 0 });
    expect(selectedLineIds()).toEqual([]);
  });

  it("hears the previous shared instance", async () => {
    await renderOpen(0);

    pressPrevInstance();

    await expect.poll(() => focus()).toEqual({ groupId: "g1", hearInstanceIdx: 1 });
  });

  it("jumps without a selection", async () => {
    await renderOpen(0);
    expect(selectedLineIds()).toEqual([]);

    pressNextInstance();

    await expect.poll(() => focus()?.hearInstanceIdx).toBe(1);
  });

  describe("edge cases", () => {
    it("stays on an open own-timing instance", async () => {
      await renderOpen(2);

      pressNextInstance();
      pressPrevInstance();

      expect(focus()).toEqual({ groupId: "g1", hearInstanceIdx: 2 });
      expect(selectedLineIds()).toEqual([]);
    });
  });

  describe("regressions", () => {
    it("regression: never selects words of an instance that is not shown", async () => {
      await renderOpen(1);
      useTimelineStore.getState().setSelectedWords(getWordsInInstance(useProjectStore.getState().lines, "g1", 1));

      pressNextInstance();

      await expect.poll(() => focus()?.hearInstanceIdx).toBe(0);
      expect(selectedLineIds()).toEqual([]);
    });

    it("regression: jumps to the start of the open instance", async () => {
      const longChorus = createLine({
        ...chorus(1, 40),
        words: [createWord({ text: "go ", begin: 40, end: 50 }), createWord({ text: "now", begin: 50, end: 60 })],
      });
      useProjectStore.setState({ lines: [chorus(0, 10), verse, longChorus, chorus(2, 70)] });
      useTimelineStore.setState({ zoom: 50 });
      await render(<TimelinePanel />);
      await expect.poll(() => document.querySelectorAll("[data-instance-key]").length).toBe(3);
      useTimelineStore.getState().openGroup("g1", 1);
      await expect.poll(() => useTimelineStore.getState().zoom).not.toBe(50);
      useTimelineStore.setState({ zoom: 50 });
      const container = scrollContainer();
      const start = 40 * 50 - FOCUS_SCROLL_MARGIN_PX;
      container.scrollLeft = start + 200;
      await expect.poll(() => container.scrollLeft).toBeGreaterThan(start);

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "J", code: "KeyJ", shiftKey: true, bubbles: true }));

      await expect.poll(() => container.scrollLeft).toBe(start);
    });
  });
});
