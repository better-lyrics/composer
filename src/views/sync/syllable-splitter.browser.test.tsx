import { describe, expect, it } from "vitest";
import { SplitModeContent, SyllableSplitter } from "@/views/sync/syllable-splitter";
import type { WordTiming } from "@/domain/word/timing";
import { render } from "@/test/render";

const SINGLE_CHAR: WordTiming = { text: "a", begin: 0, end: 1 };
const MULTI_CHAR: WordTiming = { text: "hello", begin: 0, end: 1 };

describe("SyllableSplitter", () => {
  it("renders nothing for single-character words", async () => {
    const screen = await render(<SyllableSplitter word={SINGLE_CHAR} wordIndex={0} onSplit={() => {}} />);
    expect(screen.container.querySelector("button")).toBeNull();
  });

  it("renders the scissor trigger for multi-character words", async () => {
    const screen = await render(<SyllableSplitter word={MULTI_CHAR} wordIndex={0} onSplit={() => {}} />);
    expect(screen.container.querySelector("button")).not.toBeNull();
  });

  it("opens a popover with character split points when clicked", async () => {
    const screen = await render(<SyllableSplitter word={MULTI_CHAR} wordIndex={0} onSplit={() => {}} />);
    await screen.getByRole("button", { name: /Split into syllables/i }).click();
    await expect.element(screen.getByText(/Click between letters/)).toBeInTheDocument();
    const splitButtons = document.querySelectorAll("button");
    expect(splitButtons.length).toBeGreaterThan(2);
  });

  it("emits split words when a split point is toggled and Split Word is clicked", async () => {
    let splits: WordTiming[] | null = null;
    const screen = await render(
      <SyllableSplitter
        word={{ text: "abcd", begin: 0, end: 1 }}
        wordIndex={0}
        onSplit={(_, words) => {
          splits = words;
        }}
      />,
    );
    await screen.getByRole("button", { name: /Split into syllables/i }).click();
    const splitPointButtons = Array.from(document.querySelectorAll("button")).filter(
      (b) => b.querySelector("span")?.textContent === "⋮",
    );
    splitPointButtons[0]?.click();
    await screen.getByRole("button", { name: "Split Word" }).click();
    expect(splits).not.toBeNull();
    expect((splits as unknown as WordTiming[]).length).toBeGreaterThan(1);
  });

  it("stamps a fresh syllableGroupId shared across every produced syllable", async () => {
    let splits: WordTiming[] | null = null;
    const screen = await render(
      <SyllableSplitter
        word={{ text: "every", begin: 0, end: 1 }}
        wordIndex={0}
        onSplit={(_, words) => {
          splits = words;
        }}
      />,
    );
    await screen.getByRole("button", { name: /Split into syllables/i }).click();
    const splitPointButtons = Array.from(document.querySelectorAll("button")).filter(
      (b) => b.querySelector("span")?.textContent === "⋮",
    );
    splitPointButtons[0]?.click();
    splitPointButtons[2]?.click();
    await screen.getByRole("button", { name: "Split Word" }).click();
    const out = splits as unknown as WordTiming[];
    expect(out).not.toBeNull();
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out[0].syllableGroupId).toBeDefined();
    expect(out.every((w) => w.syllableGroupId === out[0].syllableGroupId)).toBe(true);
  });

  it("reuses the source word's syllableGroupId when re-splitting", async () => {
    let splits: WordTiming[] | null = null;
    const screen = await render(
      <SyllableSplitter
        word={{ text: "ev", begin: 0, end: 1, syllableGroupId: "g_source" }}
        wordIndex={0}
        onSplit={(_, words) => {
          splits = words;
        }}
      />,
    );
    await screen.getByRole("button", { name: /Split into syllables/i }).click();
    const splitPointButtons = Array.from(document.querySelectorAll("button")).filter(
      (b) => b.querySelector("span")?.textContent === "⋮",
    );
    splitPointButtons[0]?.click();
    await screen.getByRole("button", { name: "Split Word" }).click();
    const out = splits as unknown as WordTiming[];
    expect(out).not.toBeNull();
    expect(out.every((w) => w.syllableGroupId === "g_source")).toBe(true);
  });
});

describe("SplitModeContent apply-to-all controls", () => {
  it("hides the apply-to-all block when showApplyControls is false", async () => {
    const screen = await render(
      <SplitModeContent
        text="hello"
        splitPoints={[]}
        onToggleSplit={() => {}}
        onConfirm={() => {}}
        onCancel={() => {}}
        applyToAll={false}
        onApplyToAllChange={() => {}}
        caseInsensitive={false}
        onCaseInsensitiveChange={() => {}}
        identicalCount={0}
        sourceText="hello"
        showApplyControls={false}
      />,
    );
    expect(screen.container.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it("shows both checkboxes with case-insensitive disabled when apply-to-all is off", async () => {
    const screen = await render(
      <SplitModeContent
        text="hello"
        splitPoints={[]}
        onToggleSplit={() => {}}
        onConfirm={() => {}}
        onCancel={() => {}}
        applyToAll={false}
        onApplyToAllChange={() => {}}
        caseInsensitive={false}
        onCaseInsensitiveChange={() => {}}
        identicalCount={0}
        sourceText="hello"
        showApplyControls={true}
      />,
    );
    const checkboxes = screen.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0].disabled).toBe(false);
    expect(checkboxes[1].disabled).toBe(true);
  });

  it("enables case-insensitive when apply-to-all is on", async () => {
    const screen = await render(
      <SplitModeContent
        text="hello"
        splitPoints={[]}
        onToggleSplit={() => {}}
        onConfirm={() => {}}
        onCancel={() => {}}
        applyToAll={true}
        onApplyToAllChange={() => {}}
        caseInsensitive={false}
        onCaseInsensitiveChange={() => {}}
        identicalCount={0}
        sourceText="hello"
        showApplyControls={true}
      />,
    );
    const checkboxes = screen.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(checkboxes[1].disabled).toBe(false);
  });

  it("shows the count line with pluralization when applyToAll is on and matches exist", async () => {
    const screen = await render(
      <SplitModeContent
        text="hello"
        splitPoints={[]}
        onToggleSplit={() => {}}
        onConfirm={() => {}}
        onCancel={() => {}}
        applyToAll={true}
        onApplyToAllChange={() => {}}
        caseInsensitive={false}
        onCaseInsensitiveChange={() => {}}
        identicalCount={3}
        sourceText="running"
        showApplyControls={true}
      />,
    );
    await expect.element(screen.getByText(/This will also split 3 other "running"s/)).toBeInTheDocument();
  });

  it("uses singular form when identicalCount is exactly 1", async () => {
    const screen = await render(
      <SplitModeContent
        text="hello"
        splitPoints={[]}
        onToggleSplit={() => {}}
        onConfirm={() => {}}
        onCancel={() => {}}
        applyToAll={true}
        onApplyToAllChange={() => {}}
        caseInsensitive={false}
        onCaseInsensitiveChange={() => {}}
        identicalCount={1}
        sourceText="running"
        showApplyControls={true}
      />,
    );
    await expect.element(screen.getByText('This will also split 1 other "running"')).toBeInTheDocument();
  });

  it("shows muted text when applyToAll is on with zero matches", async () => {
    const screen = await render(
      <SplitModeContent
        text="hello"
        splitPoints={[]}
        onToggleSplit={() => {}}
        onConfirm={() => {}}
        onCancel={() => {}}
        applyToAll={true}
        onApplyToAllChange={() => {}}
        caseInsensitive={false}
        onCaseInsensitiveChange={() => {}}
        identicalCount={0}
        sourceText="running"
        showApplyControls={true}
      />,
    );
    await expect.element(screen.getByText("No other matching words")).toBeInTheDocument();
  });
});
