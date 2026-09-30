import { describe, expect, it } from "vitest";
import { Toaster } from "sonner";
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { SharedTimingSuggestionsBanner } from "@/views/timeline/shared-timing-suggestions-banner";

// -- Fixtures -----------------------------------------------------------------

const member = (instanceIdx: number, begin?: number, groupId = "g1"): LyricLine =>
  createLine({
    id: `${groupId}-c${instanceIdx}`,
    text: "go now",
    groupId,
    instanceIdx,
    templateLineIdx: 0,
    ...(begin === undefined
      ? {}
      : {
          words: [
            createWord({ text: "go ", begin, end: begin + 1 }),
            createWord({ text: "now", begin: begin + 1, end: begin + 2 }),
          ],
        }),
  });

const OLD_CHORUS = createGroup({ id: "g1", label: "Chorus" });

function seed(groups: LinkGroup[], lines: LyricLine[]) {
  useProjectStore.setState({ groups, lines, dismissedSuggestions: [] });
  useProjectStore.getState().clearHistory();
}

const store = () => useProjectStore.getState();
const INLINE_TEXT = "Chorus 1 is synced. Share its timing with 2 instances?";

async function renderBanner() {
  return render(
    <>
      <Toaster />
      <SharedTimingSuggestionsBanner />
    </>,
  );
}

// -- Tests --------------------------------------------------------------------

describe("SharedTimingSuggestionsBanner", () => {
  it("suggests sharing timing for an old group with a synced instance", async () => {
    seed([OLD_CHORUS], [member(0, 10), member(1), member(2)]);
    const screen = await renderBanner();

    await expect.element(screen.getByText(INLINE_TEXT)).toBeVisible();
  });

  it("shares the group's timing on accept", async () => {
    seed([OLD_CHORUS], [member(0, 10), member(1), member(2)]);
    const screen = await renderBanner();
    await screen.getByRole("button", { name: "Share timing" }).click();

    await expect.poll(() => store().groups[0].sharesTiming).toBe(true);
    await expect.element(screen.getByText("Chorus shares timing in 3 instances")).toBeVisible();
    expect(screen.container.textContent).not.toContain(INLINE_TEXT);
  });

  it("hides on dismiss and stays hidden", async () => {
    seed([OLD_CHORUS], [member(0, 10), member(1), member(2)]);
    const screen = await renderBanner();
    await screen.getByRole("button", { name: "Dismiss suggestion" }).click();

    await expect.poll(() => store().dismissedSuggestions).toEqual(["shared-timing:g1"]);
    store().setLines([member(0, 10), member(1), member(2), member(3)]);
    await expect.poll(() => store().lines.length).toBe(4);
    expect(screen.container.textContent).not.toContain("is synced");
  });

  it("offers a review for several groups", async () => {
    const verse = createGroup({ id: "g2", label: "Verse" });
    seed([OLD_CHORUS, verse], [member(0, 10), member(1), member(0, 30, "g2"), member(1, undefined, "g2")]);
    const screen = await renderBanner();

    await expect.element(screen.getByRole("button", { name: "Review 2" })).toBeVisible();
  });

  describe("edge cases", () => {
    it("does not show for a group that already shares timing", async () => {
      seed([createGroup({ id: "g1", label: "Chorus", sharesTiming: true })], [member(0, 10), member(1)]);
      const screen = await renderBanner();

      expect(screen.container.textContent).toBe("");
    });

    it("does not show when no instance is synced", async () => {
      seed([OLD_CHORUS], [member(0), member(1)]);
      const screen = await renderBanner();

      expect(screen.container.textContent).toBe("");
    });

    it("does not show when every instance has timing", async () => {
      seed([OLD_CHORUS], [member(0, 10), member(1, 30)]);
      const screen = await renderBanner();

      expect(screen.container.textContent).toBe("");
    });

    it("uses the singular for one instance with no timing", async () => {
      seed([OLD_CHORUS], [member(0, 10), member(1)]);
      const screen = await renderBanner();

      await expect.element(screen.getByText("Chorus 1 is synced. Share its timing with 1 instance?")).toBeVisible();
    });
  });

  describe("invariants", () => {
    it("shares in one undo step and leaves the lines unchanged", async () => {
      seed([OLD_CHORUS], [member(0, 10), member(1), member(2)]);
      const before = store().lines;
      const screen = await renderBanner();
      await screen.getByRole("button", { name: "Share timing" }).click();
      await expect.poll(() => store().groups[0].sharesTiming).toBe(true);

      expect(store().lines).toEqual(before);
      store().undo();
      expect(store().groups[0].sharesTiming).toBeUndefined();
      expect(store().canUndo()).toBe(false);
    });
  });
});
