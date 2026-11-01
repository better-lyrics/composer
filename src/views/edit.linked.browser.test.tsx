import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import type { LyricLine } from "@/domain/line/model";
import { reconcileLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createGroup } from "@/test/factories";
import { render } from "@/test/render";
import { EditPanel } from "@/views/edit";

// -- Helpers ------------------------------------------------------------------

function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function getTextarea(container: HTMLElement): HTMLTextAreaElement {
  const textarea = container.querySelector("textarea");
  if (!textarea) throw new Error("textarea not rendered");
  return textarea;
}

function pasteTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  textarea.dispatchEvent(new Event("paste", { bubbles: true, cancelable: true }));
  setTextareaValue(textarea, value);
}

function linkedChorusAroundVerse(): LyricLine[] {
  return [
    reconcileLine({ id: "a0", text: "Chorus line", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 }),
    reconcileLine({ id: "x", text: "Verse", agentId: "v1" }),
    reconcileLine({ id: "b0", text: "Chorus line", agentId: "v1", groupId: "g1", instanceIdx: 1, templateLineIdx: 0 }),
  ];
}

const texts = () => useProjectStore.getState().lines.map((l) => l.text);

// -- Tests --------------------------------------------------------------------

describe("linked line edits in the edit textarea", () => {
  it("shows the propagated text on the linked sibling after the keystroke", async () => {
    useProjectStore.setState({
      activeTab: "edit",
      lines: linkedChorusAroundVerse(),
      groups: [createGroup({ id: "g1", label: "Chorus" })],
    });
    const screen = await render(<EditPanel />);
    const textarea = getTextarea(screen.container);

    setTextareaValue(textarea, "Chorus line edited\nVerse\nChorus line");

    await expect.poll(() => textarea.value).toBe("Chorus line edited\nVerse\nChorus line edited");
  });

  it("keeps the caret after the typed character when a linked sibling above grows", async () => {
    useProjectStore.setState({
      activeTab: "edit",
      lines: linkedChorusAroundVerse(),
      groups: [createGroup({ id: "g1", label: "Chorus" })],
    });
    const screen = await render(<EditPanel />);
    const textarea = getTextarea(screen.container);
    const editedRowStart = "Chorus line\nVerse\n".length;

    textarea.focus();
    textarea.setSelectionRange(editedRowStart + "Chorus".length, editedRowStart + "Chorus".length);
    await userEvent.keyboard("!");

    await expect.poll(() => textarea.value).toBe("Chorus! line\nVerse\nChorus! line");
    const expectedCaret = "Chorus! line\nVerse\nChorus!".length;
    expect(textarea.selectionStart).toBe(expectedCaret);
    expect(textarea.selectionEnd).toBe(expectedCaret);

    await userEvent.keyboard("?");
    await expect.poll(texts).toEqual(["Chorus!? line", "Verse", "Chorus!? line"]);
  });
});

describe("regressions", () => {
  it("regression: keeps the sibling edit after an unrelated keystroke", async () => {
    useProjectStore.setState({
      activeTab: "edit",
      lines: linkedChorusAroundVerse(),
      groups: [createGroup({ id: "g1", label: "Chorus" })],
    });
    const screen = await render(<EditPanel />);
    const textarea = getTextarea(screen.container);

    setTextareaValue(textarea, "Chorus line edited\nVerse\nChorus line");
    await expect.poll(texts).toEqual(["Chorus line edited", "Verse", "Chorus line edited"]);

    setTextareaValue(textarea, `${textarea.value.replace("Verse", "Verse!")}`);
    await new Promise((r) => setTimeout(r, 50));
    expect(texts()).toEqual(["Chorus line edited", "Verse!", "Chorus line edited"]);
  });
});

describe("pasting over a linked line", () => {
  it("regression: commits the extracted text without crashing when standalone background rows merge", async () => {
    useSettingsStore.setState({ autoExtractBackgroundVocals: true, mergeStandaloneBackgroundLines: true });
    useProjectStore.setState({
      activeTab: "edit",
      lines: [
        reconcileLine({
          id: "a0",
          text: "Chorus line",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
        }),
        reconcileLine({ id: "x", text: "Verse", agentId: "v1" }),
        reconcileLine({ id: "bg1", text: "(oh)", agentId: "v1" }),
        reconcileLine({ id: "bg2", text: "(yeah)", agentId: "v1" }),
        reconcileLine({
          id: "b0",
          text: "Chorus line",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
        }),
      ],
      groups: [createGroup({ id: "g1", label: "Chorus" })],
    });
    const screen = await render(<EditPanel />);
    const textarea = getTextarea(screen.container);

    textarea.focus();
    pasteTextareaValue(textarea, "Chorus song\nVerse\n(oh)\n(yeah)\nChorus line");

    await expect.poll(texts).toEqual(["Chorus song", "Verse", "Chorus song"]);
    await expect.poll(() => textarea.value).toBe("Chorus song\nVerse\nChorus song");
    expect(textarea.selectionStart).toBeLessThanOrEqual(textarea.value.length);
  });
});

describe("IME composition on a linked line", () => {
  it("shows exactly what was typed until the composition ends, then rewrites the sibling once", async () => {
    useProjectStore.setState({
      activeTab: "edit",
      lines: linkedChorusAroundVerse(),
      groups: [createGroup({ id: "g1", label: "Chorus" })],
    });
    const screen = await render(<EditPanel />);
    const textarea = getTextarea(screen.container);
    textarea.focus();

    textarea.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    setTextareaValue(textarea, "Chorusk line\nVerse\nChorus line");
    await new Promise((r) => setTimeout(r, 50));
    expect(textarea.value).toBe("Chorusk line\nVerse\nChorus line");

    setTextareaValue(textarea, "Chorusか line\nVerse\nChorus line");
    await new Promise((r) => setTimeout(r, 50));
    expect(textarea.value).toBe("Chorusか line\nVerse\nChorus line");

    textarea.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "か" }));

    await expect.poll(() => textarea.value).toBe("Chorusか line\nVerse\nChorusか line");
    await expect.poll(texts).toEqual(["Chorusか line", "Verse", "Chorusか line"]);
  });
});
