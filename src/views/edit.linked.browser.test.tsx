import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import type { LyricLine } from "@/domain/line/model";
import { reconcileLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
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
