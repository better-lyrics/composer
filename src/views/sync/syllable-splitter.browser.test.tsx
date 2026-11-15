import type { WordTiming } from "@/domain/word/timing";
import { render } from "@/test/render";
import { SyllableSplitter } from "@/views/sync/syllable-splitter";
import { describe, expect, it } from "vitest";
import { computeSyllableGroups } from "@/domain/word/syllable-groups";

const SINGLE_CHAR: WordTiming = { id: "w1", text: "a", sep: "", begin: 0, end: 1, joinsNext: true };
const MULTI_CHAR: WordTiming = { id: "w2", text: "hello", sep: "", begin: 0, end: 1, joinsNext: true };

describe("SyllableSplitter", () => {
  it("renders nothing for single-character words", async () => {
    const screen = await render(
      <SyllableSplitter lineId="test-line" type="word" word={SINGLE_CHAR} wordIndex={0} onSplit={() => {}} />,
    );
    expect(screen.container.querySelector("button")).toBeNull();
  });

  it("renders the scissor trigger for multi-character words", async () => {
    const screen = await render(
      <SyllableSplitter lineId="test-line" type="word" word={MULTI_CHAR} wordIndex={0} onSplit={() => {}} />,
    );
    expect(screen.container.querySelector("button")).not.toBeNull();
  });

  it("opens a popover with character split points when clicked", async () => {
    const screen = await render(
      <SyllableSplitter lineId="test-line" type="word" word={MULTI_CHAR} wordIndex={0} onSplit={() => {}} />,
    );
    await screen.getByRole("button", { name: /Split into syllables/i }).click();
    await expect.element(screen.getByText(/Click between letters/)).toBeInTheDocument();
    const splitButtons = document.querySelectorAll("button");
    expect(splitButtons.length).toBeGreaterThan(2);
  });

  it("shows an inferred split that lands on a transliteration space as selected", async () => {
    const screen = await render(
      <SyllableSplitter
        lineId="test-line"
        type="word"
        word={{
          id: "w3",
          text: "붙어있던",
          sep: "",
          transliteration: "but eoissdeon",
          begin: 0,
          end: 1,
          joinsNext: true,
        }}
        wordIndex={0}
        onSplit={() => {}}
      />,
    );
    await screen.getByRole("button", { name: /Split into syllables/i }).click();
    expect(document.querySelectorAll('button[aria-label^="Transliteration pronunciation break"]')).toHaveLength(1);
    expect(document.querySelector('button[aria-label="Transliteration split point 3"]')).toBeNull();
    expect(document.querySelector('button[aria-label="Transliteration split point 4"]')).toBeNull();
    await screen.getByRole("button", { name: "Original split point 1" }).click();

    await expect
      .element(screen.getByRole("button", { name: "Transliteration pronunciation break 4" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(document.body.textContent).not.toContain("Both rows need the same number of parts");
  });

  it("emits split words when a split point is toggled and Split Word is clicked", async () => {
    let splits: WordTiming[] | null = null;
    const screen = await render(
      <SyllableSplitter
        lineId="test-line"
        type="word"
        word={{ id: "w4", text: "abcd", sep: "", begin: 0, end: 1, joinsNext: true }}
        wordIndex={0}
        onSplit={(_, words) => {
          splits = words;
        }}
      />,
    );
    await screen.getByRole("button", { name: /Split into syllables/i }).click();
    await screen.getByRole("button", { name: "Split point 1" }).click();
    await screen.getByRole("button", { name: "Split Word" }).click();
    expect(splits).not.toBeNull();
    expect((splits as unknown as WordTiming[]).length).toBeGreaterThan(1);
  });

  it("joins every produced syllable into one word", async () => {
    let splits: WordTiming[] | null = null;
    const screen = await render(
      <SyllableSplitter
        lineId="test-line"
        type="word"
        word={{ id: "w5", text: "every", sep: "", begin: 0, end: 1, joinsNext: true }}
        wordIndex={0}
        onSplit={(_, words) => {
          splits = words;
        }}
      />,
    );
    await screen.getByRole("button", { name: /Split into syllables/i }).click();
    await screen.getByRole("button", { name: "Split point 1" }).click();
    await screen.getByRole("button", { name: "Split point 3" }).click();
    await screen.getByRole("button", { name: "Split Word" }).click();
    const out = splits as unknown as WordTiming[];
    expect(out).not.toBeNull();
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(computeSyllableGroups(out)).toMatchObject([{ startIndex: 0, endIndex: out.length - 1 }]);
  });

  it("keeps the source word's join on the last piece when re-splitting", async () => {
    let splits: WordTiming[] | null = null;
    const screen = await render(
      <SyllableSplitter
        lineId="test-line"
        type="word"
        word={{ id: "w6", text: "ev", sep: "", begin: 0, end: 1, joinsNext: true }}
        wordIndex={0}
        onSplit={(_, words) => {
          splits = words;
        }}
      />,
    );
    await screen.getByRole("button", { name: /Split into syllables/i }).click();
    await screen.getByRole("button", { name: "Split point 1" }).click();
    await screen.getByRole("button", { name: "Split Word" }).click();
    const out = splits as unknown as WordTiming[];
    expect(out).not.toBeNull();
    expect(out.every((w) => w.joinsNext)).toBe(true);
  });
});
