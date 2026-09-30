import { useAudioStore } from "@/stores/audio";
import { stepFrames } from "@/test/frame-steps";
import { FOCUS_SCROLL_MARGIN_PX } from "@/views/timeline/group-focus";
import {
  lineById,
  press,
  renderOpen,
  scrollContainer,
  seedGroupFocusSong,
} from "@/views/timeline/group-focus.test-helpers";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(seedGroupFocusSong);

const zoom = () => useTimelineStore.getState().zoom;

// -- Tests --------------------------------------------------------------------

describe("TimelinePanel · group focus playhead", () => {
  describe("shortcuts", () => {
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
  });

  describe("scroll", () => {
    it("zooms to fit the open instance and restores the song zoom when it closes", async () => {
      useTimelineStore.setState({ zoom: 30 });
      await renderOpen(1);

      await expect.poll(zoom).toBeGreaterThan(30);
      const container = scrollContainer();
      await expect.poll(() => 42 * zoom() - container.scrollLeft).toBeLessThanOrEqual(container.clientWidth);

      useTimelineStore.getState().closeGroup();

      await expect.poll(zoom).toBe(30);
    });

    it("edge case: keeps the fitted zoom when stepping to another instance", async () => {
      useTimelineStore.setState({ zoom: 30 });
      await renderOpen(0);
      await expect.poll(zoom).toBeGreaterThan(30);
      const fitted = zoom();

      useTimelineStore.getState().openGroup("g1", 1);

      await expect.poll(() => useTimelineStore.getState().focusedGroup?.hearInstanceIdx).toBe(1);
      expect(zoom()).toBe(fitted);
    });

    it("scrolls to the heard instance and keeps the scroll inside it", async () => {
      useTimelineStore.setState({ zoom: 50 });
      await renderOpen(1);
      const container = scrollContainer();

      await expect.poll(() => container.scrollLeft).toBeGreaterThan(40 * zoom() - 100);
      container.scrollLeft = 0;

      await expect.poll(() => container.scrollLeft).toBeGreaterThan(40 * zoom() - 100);
    });

    it("keeps the follow scroll inside the heard instance while playing elsewhere", async () => {
      useTimelineStore.setState({ zoom: 50, followEnabled: true });
      await renderOpen(1);
      const container = scrollContainer();
      await expect.poll(() => container.scrollLeft).toBeGreaterThan(40 * zoom() - 100);

      useAudioStore.setState({ currentTime: 20, isPlaying: true });
      const samples: number[] = [];
      for (let frame = 0; frame < 10; frame++) {
        await stepFrames(1);
        samples.push(container.scrollLeft);
      }

      expect(Math.min(...samples)).toBeGreaterThanOrEqual(40 * zoom() - FOCUS_SCROLL_MARGIN_PX - 1);
    });
  });
});
