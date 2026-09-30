import {
  focus,
  press,
  renderOpen,
  seedGroupFocusSong,
  shownLineIndices,
  store,
} from "@/views/timeline/group-focus.test-helpers";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { beforeEach, describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const lineIds = () => store().lines.map((line) => line.id);

beforeEach(seedGroupFocusSong);

// -- Tests --------------------------------------------------------------------

describe("TimelinePanel · editing lines in an open group", () => {
  describe("regressions", () => {
    it("regression: shows a line inserted with the shortcut instead of hiding it", async () => {
      await renderOpen(1);
      useTimelineStore.getState().setSelectedWords([{ lineId: "c1", lineIndex: 2, wordIndex: 0, type: "word" }]);

      press("n", { code: "KeyN" });

      await expect.poll(() => store().lines).toHaveLength(5);
      expect(lineIds().indexOf("c1")).toBe(2);
      await expect.poll(() => focus()).toBeNull();
      await expect.poll(() => shownLineIndices()).toContain(3);
    });

    it("regression: shows a line added from the gutter menu instead of hiding it", async () => {
      const screen = await renderOpen(1);
      useTimelineStore.getState().setContextMenu({
        x: 10,
        y: 10,
        target: { kind: "gutter", lineId: "c1", lineIndex: 2 },
      });

      await screen.getByRole("button", { name: "Add line above" }).click();

      await expect.poll(() => store().lines).toHaveLength(5);
      expect(lineIds().indexOf("c1")).toBe(3);
      await expect.poll(() => focus()).toBeNull();
    });
  });

  describe("invariants", () => {
    it("inserts the line outside the group", async () => {
      await renderOpen(1);
      useTimelineStore.getState().setSelectedWords([{ lineId: "c1", lineIndex: 2, wordIndex: 0, type: "word" }]);

      press("n", { code: "KeyN" });

      await expect.poll(() => store().lines).toHaveLength(5);
      expect(store().lines[3].groupId).toBeUndefined();
    });
  });
});
