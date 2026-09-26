import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { INITIAL_STATE as IMPORT_MODAL_INITIAL_STATE, useImportModalStore } from "@/stores/import-modal-store";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { EditPanel } from "@/views/edit";

// -- Helpers ------------------------------------------------------------------

function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function pasteIntoTextarea(textarea: HTMLTextAreaElement, value: string): void {
  textarea.focus();
  textarea.dispatchEvent(new Event("paste", { bubbles: true, cancelable: true }));
  setTextareaValue(textarea, value);
}

function previewMainTexts(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-testid="line-preview-text"]')].map((el) => el.textContent ?? "");
}

function previewBackgroundTexts(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-testid="line-preview-background"]')].map((el) => el.textContent ?? "");
}

function selectedRowTexts(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.bg-composer-accent\\/15 [data-testid="line-preview-text"]')].map(
    (el) => el.textContent ?? "",
  );
}

// -- Tests --------------------------------------------------------------------

describe("EditPanel", () => {
  it("renders a textarea or contenteditable region for editing lyrics", async () => {
    useProjectStore.setState({ lines: [] });
    const screen = await render(<EditPanel />);
    const editable = screen.container.querySelector("textarea, [contenteditable]");
    expect(editable).not.toBeNull();
  });
});

describe("background vocal extraction", () => {
  it("disables the header button when no line has parentheses", async () => {
    useProjectStore.setState({
      lines: [createLine({ text: "Hello world" }), createLine({ text: "No parens here" })],
    });
    const screen = await render(<EditPanel />);

    const button = screen.getByRole("button", { name: "Extract background vocals" });
    await expect.element(button).toBeDisabled();
  });

  it("enables the header button and converts inline parentheses on click", async () => {
    useProjectStore.setState({ lines: [createLine({ text: "Hello (ooh) world" })] });
    const screen = await render(<EditPanel />);

    const button = screen.getByRole("button", { name: "Extract background vocals" });
    await expect.element(button).toBeEnabled();

    await button.click();

    await expect.poll(() => previewMainTexts(screen.container)).toContain("Hello world");
    await expect.poll(() => previewBackgroundTexts(screen.container)).toContain("(ooh)");
    expect(useProjectStore.getState().lines[0].text).toBe("Hello world");
    expect(useProjectStore.getState().lines[0].backgroundText).toBe("(ooh)");
  });

  it("merges a standalone parenthesis line into the line above on bulk extract", async () => {
    useSettingsStore.setState({ mergeStandaloneBackgroundLines: true });
    useProjectStore.setState({
      lines: [createLine({ text: "Real lyric line" }), createLine({ text: "(ooh yeah)" })],
    });
    const screen = await render(<EditPanel />);

    const button = screen.getByRole("button", { name: "Extract background vocals" });
    await expect.element(button).toBeEnabled();
    await button.click();

    await expect.poll(() => useProjectStore.getState().lines.length).toBe(1);
    expect(useProjectStore.getState().lines[0].backgroundText).toBe("(ooh yeah)");
    await expect.poll(() => previewMainTexts(screen.container)).toEqual(["Real lyric line"]);
    await expect.poll(() => previewBackgroundTexts(screen.container)).toContain("(ooh yeah)");
  });

  it("pulls inline parentheses from a single line via the per-line popover action", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "Hello (ooh) world" })] });
    const screen = await render(<EditPanel />);

    const bgTrigger = screen.getByRole("button", { name: "BG", exact: true });
    await bgTrigger.click();

    const pullButton = screen.getByRole("button", { name: "Pull from ( )" });
    await expect.element(pullButton).toBeInTheDocument();
    await pullButton.click();

    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("Hello world");
    expect(useProjectStore.getState().lines[0].backgroundText).toBe("(ooh)");
    expect(useProjectStore.getState().lines[0].backgroundTextSource).toBe("extraction");
  });

  it("hides the per-line pull action when the line has no parentheses", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "Hello world" })] });
    const screen = await render(<EditPanel />);

    const bgTrigger = screen.getByRole("button", { name: "BG", exact: true });
    await bgTrigger.click();

    await expect
      .poll(() => [...document.querySelectorAll("p")].some((p) => p.textContent === "Background vocals"))
      .toBe(true);
    const allButtons = [...document.querySelectorAll("button")];
    expect(allButtons.some((b) => b.textContent?.includes("Pull from ( )"))).toBe(false);
  });

  it("auto-extracts parentheses when pasting lyrics with the setting on", async () => {
    useSettingsStore.setState({ autoExtractBackgroundVocals: true });
    useProjectStore.setState({ lines: [] });
    const screen = await render(<EditPanel />);

    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();

    pasteIntoTextarea(textarea, "Hello (ooh) world\nSecond (ah) line");

    await expect
      .poll(() => useProjectStore.getState().lines.map((l) => l.text))
      .toEqual(["Hello world", "Second line"]);
    expect(useProjectStore.getState().lines.map((l) => l.backgroundText)).toEqual(["(ooh)", "(ah)"]);
    await expect.poll(() => previewMainTexts(screen.container)).toEqual(["Hello world", "Second line"]);
    await expect.poll(() => previewBackgroundTexts(screen.container)).toEqual(["(ooh)", "(ah)"]);
  });

  it("keeps parentheses in the text when pasting with the setting off", async () => {
    useSettingsStore.setState({ autoExtractBackgroundVocals: false });
    useProjectStore.setState({ lines: [] });
    const screen = await render(<EditPanel />);

    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();

    pasteIntoTextarea(textarea, "Hello (ooh) world\nSecond (ah) line");

    await expect
      .poll(() => useProjectStore.getState().lines.map((l) => l.text))
      .toEqual(["Hello (ooh) world", "Second (ah) line"]);
    expect(useProjectStore.getState().lines.every((l) => l.backgroundText === undefined)).toBe(true);
  });
});

describe("manual background vocal editing", () => {
  it("labels the background vocals input", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "Hello world" })] });
    const screen = await render(<EditPanel />);

    const bgTrigger = screen.getByRole("button", { name: "BG", exact: true });
    await bgTrigger.click();

    await expect.element(screen.getByRole("textbox", { name: "Background vocals text" })).toBeInTheDocument();
  });

  it("opens the lyrics import modal when the Import Lyrics button is clicked", async () => {
    useImportModalStore.setState({ ...IMPORT_MODAL_INITIAL_STATE });
    useProjectStore.setState({ lines: [] });
    const screen = await render(<EditPanel />);

    const button = screen.getByRole("button", { name: "Import Lyrics" });
    await expect.element(button).toBeInTheDocument();

    await button.click();

    await expect.poll(() => useImportModalStore.getState().isOpen).toBe(true);
  });

  it("stamps a manual provenance when typing background text in the popover", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "Hello world" })] });
    const screen = await render(<EditPanel />);

    const bgTrigger = screen.getByRole("button", { name: "BG", exact: true });
    await bgTrigger.click();

    const input = screen.getByPlaceholder("ooh, ah, etc.");
    await input.fill("ooh");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => useProjectStore.getState().lines[0].backgroundText).toBe("ooh");
    expect(useProjectStore.getState().lines[0].backgroundTextSource).toBe("manual");
  });

  it("flips an extraction-sourced background to manual when edited in the popover", async () => {
    useProjectStore.setState({
      lines: [createLine({ id: "l1", text: "Hello world", backgroundText: "ooh", backgroundTextSource: "extraction" })],
    });
    const screen = await render(<EditPanel />);

    const bgTrigger = screen.getByRole("button", { name: "BG", exact: true });
    await bgTrigger.click();

    const input = screen.getByPlaceholder("ooh, ah, etc.");
    await input.fill("aah");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => useProjectStore.getState().lines[0].backgroundText).toBe("aah");
    expect(useProjectStore.getState().lines[0].backgroundTextSource).toBe("manual");
  });

  it("clears all three background fields when the popover text is emptied", async () => {
    useProjectStore.setState({
      lines: [createLine({ id: "l1", text: "Hello world", backgroundText: "ooh", backgroundTextSource: "extraction" })],
    });
    const screen = await render(<EditPanel />);

    const bgTrigger = screen.getByRole("button", { name: "BG", exact: true });
    await bgTrigger.click();

    const input = screen.getByPlaceholder("ooh, ah, etc.");
    await input.fill("");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => useProjectStore.getState().lines[0].backgroundText).toBeUndefined();
    expect(useProjectStore.getState().lines[0].backgroundWords).toBeUndefined();
    expect(useProjectStore.getState().lines[0].backgroundTextSource).toBeUndefined();
  });
});

describe("agent assignment", () => {
  const TWO_AGENTS = [
    { id: "v1", name: "Lead", type: "person" as const },
    { id: "v2", name: "Harmony", type: "person" as const },
  ];

  it("changes a line's agent through the per-line agent select", async () => {
    useProjectStore.setState({
      agents: TWO_AGENTS,
      lines: [createLine({ text: "Hello world", agentId: "v1" })],
    });
    const screen = await render(<EditPanel />);

    await screen.getByRole("button", { name: "Line agent", exact: true }).click();
    await screen.getByRole("option", { name: "Harmony" }).click();

    await expect.poll(() => useProjectStore.getState().lines[0].agentId).toBe("v2");
  });

  it("bulk-assigns an agent to the selected lines via the Assign agent select", async () => {
    useProjectStore.setState({
      agents: TWO_AGENTS,
      lines: [createLine({ text: "alpha", agentId: "v1" }), createLine({ text: "bravo", agentId: "v1" })],
    });
    const screen = await render(<EditPanel />);

    await screen.getByRole("button", { name: "1", exact: true }).click();
    await screen.getByRole("button", { name: "Assign agent" }).click();
    await screen.getByRole("option", { name: "Harmony" }).click();

    await expect.poll(() => useProjectStore.getState().lines[0].agentId).toBe("v2");
  });
});

describe("bulk line selection", () => {
  it("shift-clicking a second gutter selects the inclusive range from the prior click", async () => {
    useProjectStore.setState({
      lines: [
        createLine({ text: "alpha" }),
        createLine({ text: "bravo" }),
        createLine({ text: "charlie" }),
        createLine({ text: "delta" }),
        createLine({ text: "echo" }),
      ],
    });
    const screen = await render(<EditPanel />);

    const anchorGutter = screen.getByRole("button", { name: "2", exact: true });
    await anchorGutter.click();

    const targetGutter = screen.getByRole("button", { name: "4", exact: true });
    await targetGutter.click({ modifiers: ["Shift"] });

    await expect.poll(() => selectedRowTexts(screen.container).sort()).toEqual(["bravo", "charlie", "delta"]);
  });
});

describe("regressions: hand edits keep sync", () => {
  async function typeAtEndOfTextarea(text: string): Promise<void> {
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    await userEvent.keyboard(text);
  }

  it("regression: typing extra words into a line-synced line keeps its begin/end", async () => {
    useProjectStore.setState({
      lines: [createLine({ id: "l1", text: "It hurts for me", begin: 107.9, end: 110.425 })],
    });
    await render(<EditPanel />);

    await typeAtEndOfTextarea(" to wait");

    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("It hurts for me to wait");
    const line = useProjectStore.getState().lines[0];
    expect(line.begin).toBe(107.9);
    expect(line.end).toBe(110.425);
  });

  it("regression: typing an extra word into a word-synced line keeps the other words' timing", async () => {
    useProjectStore.setState({
      lines: [
        createLine({
          id: "l1",
          text: "Wish I could",
          words: [
            { text: "Wish ", begin: 1, end: 2 },
            { text: "I ", begin: 2, end: 3 },
            { text: "could", begin: 3, end: 4 },
          ],
        }),
      ],
    });
    await render(<EditPanel />);

    await typeAtEndOfTextarea(" now");

    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("Wish I could now");
    const words = useProjectStore.getState().lines[0].words ?? [];
    expect(words.map((w) => w.text)).toEqual(["Wish ", "I ", "could ", "now"]);
    expect(words.slice(0, 2)).toEqual([
      { text: "Wish ", begin: 1, end: 2 },
      { text: "I ", begin: 2, end: 3 },
    ]);
    expect(words[2].begin).toBe(3);
    expect(words[3].end).toBe(4);
  });

  it("regression: adding a word to timed background vocals in the popover keeps their timing", async () => {
    useProjectStore.setState({
      lines: [
        createLine({
          id: "l1",
          text: "Hello world",
          words: [
            { text: "Hello ", begin: 0, end: 1 },
            { text: "world", begin: 1, end: 2 },
          ],
          backgroundText: "ooh ah",
          backgroundWords: [
            { text: "ooh ", begin: 0.5, end: 1 },
            { text: "ah", begin: 1, end: 1.5 },
          ],
          backgroundTextSource: "manual",
        }),
      ],
    });
    const screen = await render(<EditPanel />);

    await screen.getByRole("button", { name: "BG", exact: true }).click();
    await screen.getByPlaceholder("ooh, ah, etc.").fill("ooh ah yeah");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => useProjectStore.getState().lines[0].backgroundText).toBe("ooh ah yeah");
    const bg = useProjectStore.getState().lines[0].backgroundWords ?? [];
    expect(bg.map((w) => w.text)).toEqual(["ooh ", "ah ", "yeah"]);
    expect(bg[0]).toEqual({ text: "ooh ", begin: 0.5, end: 1 });
    expect(bg[2].end).toBe(1.5);
  });
});

describe("regressions: typing does not reshuffle duplicate lines", () => {
  it("regression: typing on one line leaves a double-spaced chorus and its later repeat on their own timing", async () => {
    useProjectStore.setState({
      lines: [
        createLine({ id: "edit-me", text: "Always", begin: 1, end: 2 }),
        createLine({
          id: "chorus-1",
          text: "Wish  I  could",
          words: [
            { text: "Wish  ", begin: 49, end: 50 },
            { text: "I  ", begin: 50, end: 51 },
            { text: "could", begin: 51, end: 52 },
          ],
        }),
        createLine({ id: "chorus-2", text: "Wish I could", begin: 116, end: 118 }),
      ],
    });
    await render(<EditPanel />);

    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange("Always".length, "Always".length);
    await userEvent.keyboard(" yeah");

    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("Always yeah");
    const [, chorus1, chorus2] = useProjectStore.getState().lines;
    expect(chorus1.id).toBe("chorus-1");
    expect(chorus1.words?.map((w) => w.begin)).toEqual([49, 50, 51]);
    expect(chorus2.id).toBe("chorus-2");
    expect(chorus2.begin).toBe(116);
  });
});
