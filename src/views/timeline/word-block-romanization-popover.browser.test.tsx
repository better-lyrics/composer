import { beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { clearGeneratorRegistry, registerGeneratorFactory } from "@/domain/romanization/registry";
import { markPersistenceSettled } from "@/lib/persistence-settled";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { WordBlock } from "@/views/timeline/word-block";

// -- Helpers ------------------------------------------------------------------

const BLOCK_PROPS = {
  id: "wb-0",
  lineId: "L1",
  lineIndex: 0,
  wordIndex: 0,
  trackType: "word" as const,
  text: "夜",
  begin: 0,
  end: 1,
  color: "#a3c9ff",
  zoom: 50,
  isDimmed: false,
  isSelected: false,
  onClick: () => {},
  onResizeStart: () => {},
};

function seedWordSyncedWithWordTexts(): void {
  useProjectStore.setState({
    lines: [
      createLine({
        id: "L1",
        text: "夜だけど",
        words: [
          { text: "夜", begin: 0, end: 1 },
          { text: "だけど", begin: 1, end: 2 },
        ],
        romanization: {
          text: "yoru dakedo",
          wordTexts: ["yoru", "dakedo"],
          source: "generated",
        },
      }),
    ],
  });
  useProjectStore.getState().setRomanizationScheme("ja-Latn-hepburn");
}

function seedLineSyncedNoWordTexts(): void {
  useProjectStore.setState({
    lines: [
      createLine({
        id: "L1",
        text: "夜だけど",
        begin: 0,
        end: 2,
        romanization: {
          text: "yoru dakedo",
          source: "generated",
        },
      }),
    ],
  });
  useProjectStore.getState().setRomanizationScheme("ja-Latn-hepburn");
}

function altClick(element: HTMLElement): void {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, altKey: true }));
}

function findPopoverInput(): HTMLInputElement | null {
  return document.querySelector('input[aria-label="Per-word romanization text"]');
}

// -- Tests --------------------------------------------------------------------

describe("WordBlockRomanizationPopover: Alt+click trigger", () => {
  beforeEach(() => {
    clearGeneratorRegistry();
    markPersistenceSettled();
  });

  it("opens on Alt+click on a word block when the line has wordTexts", async () => {
    seedWordSyncedWithWordTexts();
    const screen = await render(<WordBlock {...BLOCK_PROPS} romanization="yoru" />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    altClick(block);
    await expect.poll(() => findPopoverInput()?.value).toBe("yoru");
  });

  it("does NOT open on plain click", async () => {
    seedWordSyncedWithWordTexts();
    let clicks = 0;
    const screen = await render(<WordBlock {...BLOCK_PROPS} romanization="yoru" onClick={() => clicks++} />, {
      dndContext: true,
    });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    block.click();
    expect(findPopoverInput()).toBeNull();
    expect(clicks).toBe(1);
  });

  it("does NOT open on Alt+click when the line has no wordTexts", async () => {
    seedLineSyncedNoWordTexts();
    const screen = await render(<WordBlock {...BLOCK_PROPS} romanization={undefined} />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    altClick(block);
    expect(findPopoverInput()).toBeNull();
  });

  it("does NOT open on Alt+click when no romanization scheme is set", async () => {
    useProjectStore.setState({
      lines: [
        createLine({
          id: "L1",
          text: "夜だけど",
          words: [
            { text: "夜", begin: 0, end: 1 },
            { text: "だけど", begin: 1, end: 2 },
          ],
          romanization: { text: "yoru dakedo", wordTexts: ["yoru", "dakedo"], source: "generated" },
        }),
      ],
    });
    const screen = await render(<WordBlock {...BLOCK_PROPS} romanization="yoru" />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    altClick(block);
    expect(findPopoverInput()).toBeNull();
  });

  it("focuses the input and selects its text on open", async () => {
    seedWordSyncedWithWordTexts();
    const screen = await render(<WordBlock {...BLOCK_PROPS} romanization="yoru" />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    altClick(block);
    await expect.poll(() => findPopoverInput()).not.toBeNull();
    await expect.poll(() => document.activeElement).toBe(findPopoverInput());
    await expect.poll(() => findPopoverInput()?.selectionStart).toBe(0);
    await expect.poll(() => findPopoverInput()?.selectionEnd).toBe("yoru".length);
  });
});

// -- Editing ------------------------------------------------------------------

describe("WordBlockRomanizationPopover: editing", () => {
  beforeEach(() => {
    clearGeneratorRegistry();
    markPersistenceSettled();
  });

  it("Enter saves the edited value into wordTexts at the right index", async () => {
    seedWordSyncedWithWordTexts();
    const screen = await render(<WordBlock {...BLOCK_PROPS} romanization="yoru" />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    altClick(block);
    await expect.poll(() => findPopoverInput()).not.toBeNull();
    await screen.getByRole("textbox", { name: /per-word romanization text/i }).fill("yo");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.wordTexts?.[0]).toBe("yo");
  });

  it("Escape cancels without writing", async () => {
    seedWordSyncedWithWordTexts();
    const before = useProjectStore.getState().lines[0].romanization?.wordTexts?.slice();
    const screen = await render(<WordBlock {...BLOCK_PROPS} romanization="yoru" />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    altClick(block);
    await expect.poll(() => findPopoverInput()).not.toBeNull();
    await userEvent.keyboard("nope");
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => findPopoverInput()).toBeNull();
    expect(useProjectStore.getState().lines[0].romanization?.wordTexts).toEqual(before);
  });

  it("Save preserves surrounding wordTexts (does not nuke siblings)", async () => {
    seedWordSyncedWithWordTexts();
    const screen = await render(<WordBlock {...BLOCK_PROPS} romanization="yoru" />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    altClick(block);
    await expect.poll(() => findPopoverInput()).not.toBeNull();
    await screen.getByRole("textbox", { name: /per-word romanization text/i }).fill("yo");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.wordTexts?.[1]).toBe("dakedo");
  });

  it("Save when input is empty replaces the slot with an empty string", async () => {
    seedWordSyncedWithWordTexts();
    const screen = await render(<WordBlock {...BLOCK_PROPS} romanization="yoru" />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    altClick(block);
    await expect.poll(() => findPopoverInput()).not.toBeNull();
    await screen.getByRole("textbox", { name: /per-word romanization text/i }).fill("");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.wordTexts).toEqual(["", "dakedo"]);
  });

  it("Save creates a history entry (writes via setLineRomanizationWithHistory)", async () => {
    seedWordSyncedWithWordTexts();
    const beforeCanUndo = useProjectStore.getState().canUndo();
    const screen = await render(<WordBlock {...BLOCK_PROPS} romanization="yoru" />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    altClick(block);
    await expect.poll(() => findPopoverInput()).not.toBeNull();
    await screen.getByRole("textbox", { name: /per-word romanization text/i }).fill("yo");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => useProjectStore.getState().canUndo()).toBe(true);
    expect(beforeCanUndo).toBe(false);
  });
});

// -- Regenerate ---------------------------------------------------------------

describe("WordBlockRomanizationPopover: regenerate-this-word", () => {
  beforeEach(() => {
    clearGeneratorRegistry();
    markPersistenceSettled();
  });

  it("clicking Regenerate calls the active generator with a single-word slice", async () => {
    seedWordSyncedWithWordTexts();
    let receivedWords: { text: string; begin: number; end: number }[] | undefined;
    registerGeneratorFactory("ja-Latn-hepburn", async () => ({
      scheme: "ja-Latn-hepburn",
      async generateLine(line) {
        receivedWords = line.words?.map((w) => ({ text: w.text, begin: w.begin, end: w.end }));
        return { text: "regen", wordTexts: ["regen"] };
      },
    }));
    const screen = await render(<WordBlock {...BLOCK_PROPS} romanization="yoru" />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    altClick(block);
    await expect.poll(() => findPopoverInput()).not.toBeNull();
    await screen.getByRole("button", { name: "Regenerate", exact: true }).click();
    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.wordTexts?.[0]).toBe("regen");
    expect(receivedWords).toEqual([{ text: "夜", begin: 0, end: 1 }]);
  });

  it("Regenerate does not change surrounding wordTexts entries", async () => {
    seedWordSyncedWithWordTexts();
    registerGeneratorFactory("ja-Latn-hepburn", async () => ({
      scheme: "ja-Latn-hepburn",
      async generateLine() {
        return { text: "regen", wordTexts: ["regen"] };
      },
    }));
    const screen = await render(<WordBlock {...BLOCK_PROPS} romanization="yoru" />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    altClick(block);
    await expect.poll(() => findPopoverInput()).not.toBeNull();
    await screen.getByRole("button", { name: "Regenerate", exact: true }).click();
    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.wordTexts?.[1]).toBe("dakedo");
  });
});

// -- History pollution --------------------------------------------------------

describe("WordBlockRomanizationPopover: history pollution", () => {
  beforeEach(() => {
    clearGeneratorRegistry();
    markPersistenceSettled();
  });

  it("clicking Regenerate after typing does not double-commit (single undo restores original)", async () => {
    seedWordSyncedWithWordTexts();
    registerGeneratorFactory("ja-Latn-hepburn", async () => ({
      scheme: "ja-Latn-hepburn",
      async generateLine() {
        return { text: "regen", wordTexts: ["regen"] };
      },
    }));
    const screen = await render(<WordBlock {...BLOCK_PROPS} romanization="yoru" />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    altClick(block);
    await expect.poll(() => findPopoverInput()).not.toBeNull();
    await screen.getByRole("textbox", { name: /per-word romanization text/i }).fill("edited");
    await userEvent.tab();
    await screen.getByRole("button", { name: "Regenerate", exact: true }).click();
    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.wordTexts?.[0]).toBe("regen");
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines[0].romanization?.wordTexts?.[0]).toBe("yoru");
  });
});

// -- Source word display ------------------------------------------------------

describe("WordBlockRomanizationPopover: source word display", () => {
  beforeEach(() => {
    clearGeneratorRegistry();
    markPersistenceSettled();
  });

  it("shows the source word above the input", async () => {
    seedWordSyncedWithWordTexts();
    const screen = await render(<WordBlock {...BLOCK_PROPS} romanization="yoru" />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    altClick(block);
    await expect.poll(() => findPopoverInput()).not.toBeNull();
    const source = document.querySelector('p[title="夜"]') as HTMLElement | null;
    expect(source?.textContent).toBe("夜");
  });
});
