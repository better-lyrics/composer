import { IconClock, IconLayoutRows } from "@tabler/icons-react";
import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import type { ModalNavSection } from "@/ui/modal-nav-layout";
import { withMatchCounts } from "@/ui/nav-match-counts";

const SECTIONS: readonly ModalNavSection<"timeline" | "sync">[] = [
  { id: "timeline", label: "Timeline", icon: IconLayoutRows },
  { id: "sync", label: "Sync", icon: IconClock },
];

describe("withMatchCounts", () => {
  it("shows the count on matching sections and dims the rest", async () => {
    const [timeline, sync] = withMatchCounts(SECTIONS, { timeline: 3 });
    expect(timeline.dimmed).toBe(false);
    expect(sync.dimmed).toBe(true);
    expect(sync.trailing).toBeUndefined();
    const screen = await render(<span>{timeline.trailing}</span>);
    expect(screen.container.textContent).toBe("3");
  });

  describe("invariants", () => {
    it("leaves the input sections untouched", () => {
      withMatchCounts(SECTIONS, { timeline: 1 });
      expect(SECTIONS[0]).not.toHaveProperty("dimmed");
    });
  });
});
