import { fieldUpdates } from "@/test/field-updates";
import { lineText } from "@/domain/line/text";
import { lineFromFields } from "@/domain/line/line-from-fields";
import { useProjectStore } from "@/stores/project";
import { render } from "@/test/render";
import { isMac } from "@/utils/platform";
import { EditorScreen } from "@/views/editor-screen";
import { LanguagesPanel } from "@/views/languages";
import { beforeEach, describe, expect, it } from "vitest";
import { pasteLines } from "@/domain/commands/instance-rows";

// -- Constants ----------------------------------------------------------------

const MOD = { metaKey: isMac, ctrlKey: !isMac };
const FIRST_TEXT = "こんにちは";
const SECOND_TEXT = "さようなら";

// -- Helpers ------------------------------------------------------------------

function press(target: EventTarget, init: KeyboardEventInit): void {
  target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
}

function firstLineText(): string {
  return lineText(useProjectStore.getState().lines[0]);
}

// -- Tests --------------------------------------------------------------------

describe("Languages undo history", () => {
  beforeEach(() => {
    const store = useProjectStore.getState();
    store.setMetadata({ language: "ja" });
    store.restoreLyrics({ lines: [lineFromFields({ id: "line", text: FIRST_TEXT, agentId: "v1" })] });
    store.clearHistory();
    store.commit(pasteLines(fieldUpdates([{ id: "line", updates: { text: SECOND_TEXT } }])));
    store.undo();
    store.setActiveTab("languages");
  });

  it("regression: opening the tab keeps redo and needs no extra undo", async () => {
    const screen = await render(<LanguagesPanel />);
    await expect.element(screen.getByRole("button", { name: "Add language", exact: true })).toBeInTheDocument();

    expect(useProjectStore.getState().canRedo()).toBe(true);
    useProjectStore.getState().redo();
    expect(firstLineText()).toBe(SECOND_TEXT);
    useProjectStore.getState().undo();
    expect(firstLineText()).toBe(FIRST_TEXT);
  });

  it("redoes and undoes with the history shortcuts on the Languages tab", async () => {
    const screen = await render(<EditorScreen />, { withRouter: true });
    await expect.element(screen.getByRole("button", { name: "Add language", exact: true })).toBeInTheDocument();

    press(window, { key: "z", code: "KeyZ", shiftKey: true, ...MOD });
    await expect.poll(firstLineText).toBe(SECOND_TEXT);
    press(window, { key: "z", code: "KeyZ", ...MOD });
    await expect.poll(firstLineText).toBe(FIRST_TEXT);
  });

  it("leaves held repeats and typing in a field to one step and the field", async () => {
    const screen = await render(<EditorScreen />, { withRouter: true });
    await expect.element(screen.getByRole("button", { name: "Add language", exact: true })).toBeInTheDocument();

    press(window, { key: "z", code: "KeyZ", shiftKey: true, repeat: true, ...MOD });
    const field = screen.getByRole("textbox", { name: "Transliteration", exact: true }).element();
    press(field, { key: "z", code: "KeyZ", shiftKey: true, ...MOD });

    expect(firstLineText()).toBe(FIRST_TEXT);
    expect(useProjectStore.getState().canRedo()).toBe(true);
  });
});
