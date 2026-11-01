import { useProjectStore } from "@/stores/project";
import { render } from "@/test/render";
import { isMac } from "@/utils/platform";
import { EditorScreen } from "@/views/editor-screen";
import { LanguagesPanel } from "@/views/languages";
import { beforeEach, describe, expect, it } from "vitest";

// -- Constants ----------------------------------------------------------------

const MOD = { metaKey: isMac, ctrlKey: !isMac };
const FIRST_TEXT = "こんにちは";
const SECOND_TEXT = "さようなら";

// -- Helpers ------------------------------------------------------------------

function press(target: EventTarget, init: KeyboardEventInit): void {
  target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
}

function lineText(): string {
  return useProjectStore.getState().lines[0].text;
}

// -- Tests --------------------------------------------------------------------

describe("Languages undo history", () => {
  beforeEach(() => {
    const store = useProjectStore.getState();
    store.setMetadata({ language: "ja" });
    store.setLines([{ id: "line", text: FIRST_TEXT, agentId: "v1" }]);
    store.clearHistory();
    store.updateLineWithHistory("line", { text: SECOND_TEXT });
    store.undo();
    store.setActiveTab("languages");
  });

  it("regression: opening the tab keeps redo and needs no extra undo", async () => {
    const screen = await render(<LanguagesPanel />);
    await expect.element(screen.getByRole("button", { name: "Add language", exact: true })).toBeInTheDocument();

    expect(useProjectStore.getState().canRedo()).toBe(true);
    useProjectStore.getState().redo();
    expect(lineText()).toBe(SECOND_TEXT);
    useProjectStore.getState().undo();
    expect(lineText()).toBe(FIRST_TEXT);
  });

  it("redoes and undoes with the history shortcuts on the Languages tab", async () => {
    const screen = await render(<EditorScreen />, { withRouter: true });
    await expect.element(screen.getByRole("button", { name: "Add language", exact: true })).toBeInTheDocument();

    press(window, { key: "z", code: "KeyZ", shiftKey: true, ...MOD });
    await expect.poll(lineText).toBe(SECOND_TEXT);
    press(window, { key: "z", code: "KeyZ", ...MOD });
    await expect.poll(lineText).toBe(FIRST_TEXT);
  });

  it("leaves held repeats and typing in a field to one step and the field", async () => {
    const screen = await render(<EditorScreen />, { withRouter: true });
    await expect.element(screen.getByRole("button", { name: "Add language", exact: true })).toBeInTheDocument();

    press(window, { key: "z", code: "KeyZ", shiftKey: true, repeat: true, ...MOD });
    const field = screen.getByRole("textbox", { name: "Transliteration", exact: true }).element();
    press(field, { key: "z", code: "KeyZ", shiftKey: true, ...MOD });

    expect(lineText()).toBe(FIRST_TEXT);
    expect(useProjectStore.getState().canRedo()).toBe(true);
  });
});
