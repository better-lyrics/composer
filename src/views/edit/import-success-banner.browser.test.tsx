import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import type { LyricLine } from "@/domain/line/model";
import { ImportSuccessBanner } from "@/views/edit/import-success-banner";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function parseResultOf(lines: LyricLine[], hasTimingData = false) {
  return { lines, metadata: {}, hasTimingData, issues: [] };
}

// -- Tests --------------------------------------------------------------------

describe("ImportSuccessBanner", () => {
  it("says how many lines came from which file", async () => {
    const screen = await render(
      <ImportSuccessBanner
        result={parseResultOf([createLine({ text: "one" }), createLine({ text: "two" })])}
        filename="song.txt"
        onDismiss={() => {}}
      />,
    );
    await expect.element(screen.getByText("Imported 2 lines from song.txt")).toBeInTheDocument();
  });

  it("regression: says 1 line, not 1 lines, for a single imported line", async () => {
    const screen = await render(
      <ImportSuccessBanner
        result={parseResultOf([createLine({ text: "a", begin: 0, end: 1 })], true)}
        filename="song.lrc"
        onDismiss={() => {}}
      />,
    );
    await expect.element(screen.getByText("Imported 1 line from song.lrc with 1 timed line")).toBeInTheDocument();
  });

  it("names its icon-only dismiss button and calls onDismiss", async () => {
    let dismissed = 0;
    const screen = await render(
      <ImportSuccessBanner
        result={parseResultOf([createLine({ text: "one" })])}
        filename="song.txt"
        onDismiss={() => dismissed++}
      />,
    );
    await screen.getByRole("button", { name: "Dismiss" }).click();
    expect(dismissed).toBe(1);
  });

  it("counts word-timed lines ahead of line-timed ones", async () => {
    const screen = await render(
      <ImportSuccessBanner
        result={parseResultOf(
          [
            createLine({ text: "a", begin: 0, end: 1, words: [{ text: "a", begin: 0, end: 1 }] }),
            createLine({ text: "b", begin: 1, end: 2, words: [{ text: "b", begin: 1, end: 2 }] }),
            createLine({ text: "c", begin: 2, end: 3 }),
          ],
          true,
        )}
        filename="song.ttml"
        onDismiss={() => {}}
      />,
    );
    await expect
      .element(screen.getByText("Imported 3 lines from song.ttml with 2 word-timed lines"))
      .toBeInTheDocument();
  });
});
