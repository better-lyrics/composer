import { beforeEach, describe, expect, it } from "vitest";
import { backgroundText, lineText } from "insync/line-text";
import { backgroundTrack } from "insync/line-track";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { render } from "@/test/render";
import { EditPanel } from "@/views/edit";
import { getSplitCharacter } from "@/utils/split-character";

// -- Helpers ------------------------------------------------------------------

function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function blurTextarea(textarea: HTMLTextAreaElement): void {
  textarea.focus();
  textarea.blur();
}

function previewMainTexts(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-testid="line-preview-text"]')].map((el) => el.textContent ?? "");
}

function previewBackgroundTexts(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-testid="line-preview-background"]')].map((el) => el.textContent ?? "");
}

// -- Tests --------------------------------------------------------------------

describe("auto-extract background vocals on blur", () => {
  beforeEach(() => {
    useProjectStore.setState({ activeTab: "edit" });
    useSettingsStore.setState({ autoExtractBackgroundVocals: true, mergeStandaloneBackgroundLines: true });
  });

  it("extracts inline parentheses when the textarea is blurred", async () => {
    useProjectStore.setState({ lines: [] });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;

    setTextareaValue(textarea, "Take me home (country roads)");
    // A closed bracket group now becomes the background as it is typed; blur keeps it.
    await expect
      .poll(() => useProjectStore.getState().lines.map((l) => lineText(l, getSplitCharacter())))
      .toEqual(["Take me home"]);

    blurTextarea(textarea);

    await expect.poll(() => lineText(useProjectStore.getState().lines[0], getSplitCharacter())).toBe("Take me home");
    expect(backgroundText(useProjectStore.getState().lines[0], getSplitCharacter())).toBe("(country roads)");
    expect(backgroundTrack(useProjectStore.getState().lines[0])?.source).toBe("extraction");
  });

  it("reflects the extracted result in the textarea and preview after blur", async () => {
    useProjectStore.setState({ lines: [] });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;

    setTextareaValue(textarea, "Take me home (country roads)");
    blurTextarea(textarea);

    await expect.poll(() => textarea.value).toBe("Take me home (country roads)");
    await expect.poll(() => previewMainTexts(screen.container)).toEqual(["Take me home"]);
    await expect.poll(() => previewBackgroundTexts(screen.container)).toEqual(["(country roads)"]);
  });

  it("leaves parentheses literal on blur when the setting is off", async () => {
    useSettingsStore.setState({ autoExtractBackgroundVocals: false });
    useProjectStore.setState({ lines: [] });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;

    setTextareaValue(textarea, "Take me home (country roads)");
    blurTextarea(textarea);

    await expect
      .poll(() => lineText(useProjectStore.getState().lines[0], getSplitCharacter()))
      .toBe("Take me home (country roads)");
    expect(backgroundText(useProjectStore.getState().lines[0], getSplitCharacter())).toBeUndefined();
    expect(textarea.value).toBe("Take me home (country roads)");
  });

  it("merges a standalone all-parens line into the line above on blur", async () => {
    useProjectStore.setState({ lines: [] });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;

    setTextareaValue(textarea, "Real lyric line\n(ooh yeah)");
    await expect.poll(() => useProjectStore.getState().lines.length).toBe(2);

    blurTextarea(textarea);

    await expect.poll(() => useProjectStore.getState().lines.length).toBe(1);
    expect(lineText(useProjectStore.getState().lines[0], getSplitCharacter())).toBe("Real lyric line");
    expect(backgroundText(useProjectStore.getState().lines[0], getSplitCharacter())).toBe("(ooh yeah)");
    await expect.poll(() => textarea.value).toBe("Real lyric line (ooh yeah)");
  });

  it("keeps a standalone all-parens line on blur when merge setting is off", async () => {
    useSettingsStore.setState({ mergeStandaloneBackgroundLines: false });
    useProjectStore.setState({ lines: [] });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;

    setTextareaValue(textarea, "Real lyric line\n(ooh yeah)");
    blurTextarea(textarea);

    await expect.poll(() => useProjectStore.getState().lines.length).toBe(2);
    expect(lineText(useProjectStore.getState().lines[1], getSplitCharacter())).toBe("(ooh yeah)");
  });
});

describe("auto-extract on blur leaves history untouched when nothing changes", () => {
  beforeEach(() => {
    useProjectStore.setState({ activeTab: "edit" });
    useSettingsStore.setState({ autoExtractBackgroundVocals: true, mergeStandaloneBackgroundLines: true });
  });

  it("adds no history entry when blurring with no parentheses to extract", async () => {
    useProjectStore.setState({ lines: [] });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;

    setTextareaValue(textarea, "Plain lyric line");
    await expect
      .poll(() => lineText(useProjectStore.getState().lines[0], getSplitCharacter()))
      .toBe("Plain lyric line");

    blurTextarea(textarea);
    await expect
      .poll(() => lineText(useProjectStore.getState().lines[0], getSplitCharacter()))
      .toBe("Plain lyric line");
    const afterTypingRunIndex = useProjectStore.getState().historyIndex;

    blurTextarea(textarea);
    expect(useProjectStore.getState().historyIndex).toBe(afterTypingRunIndex);
  });

  it("adds no history entry when blurring with no edits at all", async () => {
    useProjectStore.setState({ lines: [] });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;

    const beforeIndex = useProjectStore.getState().historyIndex;
    const beforeCanUndo = useProjectStore.getState().canUndo();

    blurTextarea(textarea);

    expect(useProjectStore.getState().historyIndex).toBe(beforeIndex);
    expect(useProjectStore.getState().canUndo()).toBe(beforeCanUndo);
  });
});

describe("undo after auto-extract on blur", () => {
  beforeEach(() => {
    useProjectStore.setState({ activeTab: "edit" });
    useSettingsStore.setState({ autoExtractBackgroundVocals: true, mergeStandaloneBackgroundLines: true });
  });

  // Typed brackets now extract with the keystroke that closes them, so typing and extraction are one undo step.
  it("reverts the typing and its extraction in one undo", async () => {
    useProjectStore.setState({ lines: [] });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;

    setTextareaValue(textarea, "Take me home (country roads)");
    await expect.poll(() => lineText(useProjectStore.getState().lines[0], getSplitCharacter())).toBe("Take me home");

    blurTextarea(textarea);
    await expect.poll(() => lineText(useProjectStore.getState().lines[0], getSplitCharacter())).toBe("Take me home");

    useProjectStore.getState().undo();
    await expect.poll(() => useProjectStore.getState().lines.length).toBe(0);
  });

  it("restores the extraction on redo", async () => {
    useProjectStore.setState({ lines: [] });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;

    setTextareaValue(textarea, "Take me home (country roads)");
    blurTextarea(textarea);
    await expect.poll(() => lineText(useProjectStore.getState().lines[0], getSplitCharacter())).toBe("Take me home");

    // The typing and its extraction are one undo step.
    useProjectStore.getState().undo();
    await expect.poll(() => useProjectStore.getState().lines.length).toBe(0);

    useProjectStore.getState().redo();
    await expect.poll(() => lineText(useProjectStore.getState().lines[0], getSplitCharacter())).toBe("Take me home");
    expect(backgroundText(useProjectStore.getState().lines[0], getSplitCharacter())).toBe("(country roads)");
  });
});

describe("auto-extract on blur preserves existing blur behavior", () => {
  beforeEach(() => {
    useProjectStore.setState({ activeTab: "edit" });
    useSettingsStore.setState({ autoExtractBackgroundVocals: true, mergeStandaloneBackgroundLines: true });
  });

  it("still finalizes a pending typing run as its own undo step", async () => {
    useProjectStore.setState({ lines: [] });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;

    setTextareaValue(textarea, "Plain lyric line");
    await expect
      .poll(() => lineText(useProjectStore.getState().lines[0], getSplitCharacter()))
      .toBe("Plain lyric line");

    blurTextarea(textarea);

    useProjectStore.getState().undo();
    await expect.poll(() => useProjectStore.getState().lines.length).toBe(0);
  });
});
