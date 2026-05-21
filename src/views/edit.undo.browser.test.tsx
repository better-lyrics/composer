import { describe, expect, it } from "vitest";
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

function blurTextarea(textarea: HTMLTextAreaElement): void {
  textarea.focus();
  textarea.blur();
}

function pressUndo(textarea: HTMLTextAreaElement, opts: { ctrl?: boolean } = {}): void {
  textarea.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "z",
      code: "KeyZ",
      metaKey: !opts.ctrl,
      ctrlKey: opts.ctrl ?? false,
      bubbles: true,
      cancelable: true,
    }),
  );
}

function pressRedo(textarea: HTMLTextAreaElement, opts: { ctrlY?: boolean } = {}): void {
  const init: KeyboardEventInit = opts.ctrlY
    ? { key: "y", code: "KeyY", ctrlKey: true }
    : { key: "z", code: "KeyZ", metaKey: true, shiftKey: true };
  textarea.dispatchEvent(new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true }));
}

// -- Tests --------------------------------------------------------------------

describe("editor undo and redo", () => {
  it("reverts a typing run on blur then undo, and redo restores it", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "Hello" })] });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;

    setTextareaValue(textarea, "Hello world");
    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("Hello world");

    blurTextarea(textarea);

    useProjectStore.getState().undo();
    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("Hello");
    await expect.poll(() => textarea.value).toBe("Hello");
    await expect.poll(() => previewMainTexts(screen.container)).toEqual(["Hello"]);

    useProjectStore.getState().redo();
    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("Hello world");
    await expect.poll(() => textarea.value).toBe("Hello world");
    await expect.poll(() => previewMainTexts(screen.container)).toEqual(["Hello world"]);
  });

  it("reverts a typing run in one step on Cmd+Z", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "Hello" })] });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;

    setTextareaValue(textarea, "Hello there");
    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("Hello there");

    pressUndo(textarea);
    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("Hello");
    await expect.poll(() => textarea.value).toBe("Hello");
  });

  it("reverts a typing run on Ctrl+Z", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "Hello" })] });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;

    setTextareaValue(textarea, "Hello again");
    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("Hello again");

    pressUndo(textarea, { ctrl: true });
    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("Hello");
    await expect.poll(() => textarea.value).toBe("Hello");
  });

  it("restores via Cmd+Shift+Z after undo", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "Hello" })] });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;

    setTextareaValue(textarea, "Hello world");
    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("Hello world");

    pressUndo(textarea);
    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("Hello");

    pressRedo(textarea);
    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("Hello world");
    await expect.poll(() => textarea.value).toBe("Hello world");
  });

  it("restores via Ctrl+Y after undo", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "Hello" })] });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;

    setTextareaValue(textarea, "Hello world");
    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("Hello world");

    pressUndo(textarea);
    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("Hello");

    pressRedo(textarea, { ctrlY: true });
    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("Hello world");
    await expect.poll(() => textarea.value).toBe("Hello world");
  });

  it("reverts an entire paste as one undo entry", async () => {
    useSettingsStore.setState({ autoExtractBackgroundVocals: false });
    useProjectStore.setState({ lines: [] });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;

    pasteIntoTextarea(textarea, "First line\nSecond line\nThird line");
    await expect
      .poll(() => useProjectStore.getState().lines.map((l) => l.text))
      .toEqual(["First line", "Second line", "Third line"]);

    pressUndo(textarea);
    await expect.poll(() => useProjectStore.getState().lines.length).toBe(0);
    await expect.poll(() => textarea.value).toBe("");
  });

  it("treats a typing run and an immediate paste as two undo entries", async () => {
    useSettingsStore.setState({ autoExtractBackgroundVocals: false });
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "Start" })] });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;

    setTextareaValue(textarea, "Start typed");
    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("Start typed");

    pasteIntoTextarea(textarea, "Start typed\nPasted line");
    await expect
      .poll(() => useProjectStore.getState().lines.map((l) => l.text))
      .toEqual(["Start typed", "Pasted line"]);

    pressUndo(textarea);
    await expect.poll(() => useProjectStore.getState().lines.map((l) => l.text)).toEqual(["Start typed"]);

    pressUndo(textarea);
    await expect.poll(() => useProjectStore.getState().lines.map((l) => l.text)).toEqual(["Start"]);
  });

  it("treats two blurred typing runs as two undo steps", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "A" })] });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;

    setTextareaValue(textarea, "AB");
    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("AB");
    blurTextarea(textarea);

    setTextareaValue(textarea, "ABC");
    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("ABC");
    blurTextarea(textarea);

    pressUndo(textarea);
    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("AB");

    pressUndo(textarea);
    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("A");
  });
});

describe("editor undo edge cases", () => {
  it("does not corrupt text when Cmd+Z runs with nothing to undo", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "Untouched" })] });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;

    pressUndo(textarea);
    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("Untouched");
    expect(textarea.value).toBe("Untouched");
  });

  it("does not reintroduce stale text from a prior edit on Cmd+Z", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "Base" })] });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;

    setTextareaValue(textarea, "Base A");
    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("Base A");
    blurTextarea(textarea);

    setTextareaValue(textarea, "Base B");
    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("Base B");
    blurTextarea(textarea);

    pressUndo(textarea);
    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("Base A");
    await expect.poll(() => textarea.value).toBe("Base A");
  });

  it("passes through a non-modifier keystroke untouched", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "Hello" })] });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;

    const event = new KeyboardEvent("keydown", { key: "a", code: "KeyA", bubbles: true, cancelable: true });
    textarea.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("passes through a Cmd combo that is not undo or redo", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "Hello" })] });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;

    const event = new KeyboardEvent("keydown", {
      key: "a",
      code: "KeyA",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    textarea.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("prevents the native textarea undo on Cmd+Z", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "Hello" })] });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;

    setTextareaValue(textarea, "Hello world");
    await expect.poll(() => useProjectStore.getState().lines[0].text).toBe("Hello world");

    const event = new KeyboardEvent("keydown", {
      key: "z",
      code: "KeyZ",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    textarea.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
