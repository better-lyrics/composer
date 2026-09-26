import type { WordTiming } from "@/domain/word/timing";
import { render } from "@/test/render";
import { TransliterationTimingMap } from "@/views/languages/transliteration-timing-map";
import { describe, expect, it } from "vitest";

// -- Fixtures -------------------------------------------------------------------

function word(text: string, begin: number, end: number): WordTiming {
  return { text, begin, end };
}

// -- Tests ------------------------------------------------------------------------

describe("TransliterationTimingMap", () => {
  describe("happy path", () => {
    it("renders an arrow between chips and the slice text in bold", async () => {
      const words = [word("ga ", 0, 0.5), word("na", 0.5, 1)];
      const slices = [{ text: "ga" }, { text: "na" }];
      const screen = await render(<TransliterationTimingMap words={words} slices={slices} />);
      const group = screen.getByRole("group", { name: "Timing map" });
      await expect.element(group).toBeInTheDocument();
      expect(screen.container.querySelectorAll("svg")).toHaveLength(1);
      const boldChips = screen.container.querySelectorAll(".font-medium");
      expect(Array.from(boldChips, (el) => el.textContent)).toEqual(["ga", "na"]);
    });
  });

  describe("edge cases", () => {
    it("renders no arrow for a single word", async () => {
      const words = [word("solo", 0, 1)];
      const screen = await render(<TransliterationTimingMap words={words} slices={[{ text: "solo" }]} />);
      expect(screen.container.querySelectorAll("svg")).toHaveLength(0);
    });

    it("shows missing in the negative color when a slice is empty", async () => {
      const words = [word("a ", 0, 1), word("b", 1, 2)];
      const slices = [{ text: "" }, { text: "bee" }];
      const screen = await render(<TransliterationTimingMap words={words} slices={slices} />);
      const missing = screen.getByText("missing", { exact: true });
      await expect.element(missing).toHaveClass("text-composer-negative");
      const present = screen.getByText("bee", { exact: true });
      await expect.element(present).not.toHaveClass("text-composer-negative");
    });

    it("uses the trailing joiner only for the last word's slice", async () => {
      const words = [word("to- ", 0, 1), word("do", 1, 2)];
      const slices = [{ text: "to" }, { text: "do" }];
      const screen = await render(<TransliterationTimingMap words={words} slices={slices} trailingJoiner="-" />);
      await expect.element(screen.getByText("to", { exact: true })).toBeInTheDocument();
      await expect.element(screen.getByText("do-", { exact: true })).toBeInTheDocument();
    });
  });

  describe("invariants", () => {
    it("keeps role group and aria-label Timing map regardless of content", async () => {
      const empty = await render(<TransliterationTimingMap words={[]} slices={[]} />);
      await expect.element(empty.getByRole("group", { name: "Timing map" })).toBeInTheDocument();
      await empty.unmount();

      const filled = await render(
        <TransliterationTimingMap words={[word("a", 0, 1), word("b", 1, 2)]} slices={[{ text: "a" }, { text: "b" }]} />,
      );
      await expect.element(filled.getByRole("group", { name: "Timing map" })).toBeInTheDocument();
    });
  });
});
