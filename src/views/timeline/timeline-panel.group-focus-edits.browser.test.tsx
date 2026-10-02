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
import { userEvent } from "vitest/browser";

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

  describe("word drag", () => {
    it("cancels a word drag with Escape and keeps the group open", async () => {
      await renderOpen(1);
      const block = document.querySelector<HTMLElement>('[data-track="word"][data-line-index="2"] [data-word-block]');
      if (!block) throw new Error("word block not rendered");
      const rect = block.getBoundingClientRect();
      const start = { clientX: rect.left + 4, clientY: rect.top + rect.height / 2 };
      const pointer = { bubbles: true, cancelable: true, isPrimary: true, pointerId: 1, button: 0 };

      block.dispatchEvent(new PointerEvent("pointerdown", { ...pointer, ...start }));
      document.dispatchEvent(new PointerEvent("pointermove", { ...pointer, ...start, clientX: start.clientX + 40 }));
      await expect.poll(() => document.body.style.cursor).toBe("grabbing");

      await userEvent.keyboard("{Escape}");

      await expect.poll(() => document.body.style.cursor).not.toBe("grabbing");
      expect(focus()).toEqual({ groupId: "g1", hearInstanceIdx: 1 });
      expect(store().lines.find((line) => line.id === "c1")?.words?.[0].begin).toBe(40);

      await userEvent.keyboard("{Escape}");

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
