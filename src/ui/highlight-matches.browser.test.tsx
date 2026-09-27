import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { HighlightMatches } from "@/ui/highlight-matches";

const marks = (container: HTMLElement) => [...container.querySelectorAll("mark")].map((mark) => mark.textContent);

describe("HighlightMatches", () => {
  it("wraps every occurrence of each term in a mark", async () => {
    const screen = await render(<HighlightMatches text="Snap playhead to snap points" query="snap points" />);
    expect(marks(screen.container)).toEqual(["Snap", "snap", "points"]);
    expect(screen.container.textContent).toBe("Snap playhead to snap points");
  });

  describe("edge cases", () => {
    it("renders plain text for an empty query", async () => {
      const screen = await render(<HighlightMatches text="Follow playhead" query="   " />);
      expect(marks(screen.container)).toEqual([]);
      expect(screen.container.textContent).toBe("Follow playhead");
    });

    it("treats regex characters in the query literally", async () => {
      const screen = await render(<HighlightMatches text="Snap (magnet)" query="(magnet" />);
      expect(marks(screen.container)).toEqual(["(magnet"]);
    });

    it("renders plain text when nothing matches", async () => {
      const screen = await render(<HighlightMatches text="Follow playhead" query="zoom" />);
      expect(marks(screen.container)).toEqual([]);
    });
  });

  describe("invariants", () => {
    it("never changes the visible text", async () => {
      const text = "Clicking or dragging the playhead snaps it";
      const screen = await render(<HighlightMatches text={text} query="PLAYHEAD snaps" />);
      expect(screen.container.textContent).toBe(text);
    });
  });
});
