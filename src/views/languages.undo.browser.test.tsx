import { googleLanguageProvider } from "@/services/google-language-provider";
import { useProjectStore } from "@/stores/project";
import { render } from "@/test/render";
import { isMac } from "@/utils/platform";
import { LanguagesPanel } from "@/views/languages";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

function englishTranslation(): string | undefined {
  return useProjectStore.getState().lines[0].translations?.en?.text;
}

// -- Tests --------------------------------------------------------------------

describe("Languages undo history", () => {
  beforeEach(() => {
    vi.spyOn(googleLanguageProvider, "transliterate").mockImplementation(async (lines) => ({
      detectedLanguage: "ja",
      language: "ja-Latn",
      lines: lines.map((line) => ({ id: line.id, text: `roman ${line.text}`, segments: [] })),
    }));
    vi.spyOn(googleLanguageProvider, "translate").mockImplementation(async (lines) => ({
      detectedLanguage: "ja",
      lines: lines.map((line) => ({ id: line.id, text: `english ${line.text}` })),
    }));
    const store = useProjectStore.getState();
    store.setMetadata({ language: "ja" });
    store.setLines([{ id: "line", text: FIRST_TEXT, agentId: "v1" }]);
    store.clearHistory();
    store.updateLineWithHistory("line", { text: SECOND_TEXT });
    store.undo();
    store.setActiveTab("languages");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("regression: opening the tab keeps redo and needs no extra undo", async () => {
    await render(<LanguagesPanel />);
    await expect.poll(englishTranslation).toBe(`english ${FIRST_TEXT}`);

    expect(useProjectStore.getState().canRedo()).toBe(true);
    useProjectStore.getState().redo();
    expect(lineText()).toBe(SECOND_TEXT);
    useProjectStore.getState().undo();
    expect(lineText()).toBe(FIRST_TEXT);
    expect(englishTranslation()).toBe(`english ${FIRST_TEXT}`);
  });

  it("redoes and undoes with the history shortcuts on the Languages tab", async () => {
    await render(<LanguagesPanel />);
    await expect.poll(englishTranslation).toBe(`english ${FIRST_TEXT}`);

    press(window, { key: "z", code: "KeyZ", shiftKey: true, ...MOD });
    await expect.poll(lineText).toBe(SECOND_TEXT);
    press(window, { key: "z", code: "KeyZ", ...MOD });
    await expect.poll(lineText).toBe(FIRST_TEXT);
  });

  it("leaves held repeats and typing in a field to one step and the field", async () => {
    const screen = await render(<LanguagesPanel />);
    await expect.poll(englishTranslation).toBe(`english ${FIRST_TEXT}`);

    press(window, { key: "z", code: "KeyZ", shiftKey: true, repeat: true, ...MOD });
    const field = screen.getByRole("textbox", { name: "English", exact: true }).element();
    press(field, { key: "z", code: "KeyZ", shiftKey: true, ...MOD });

    expect(lineText()).toBe(FIRST_TEXT);
    expect(useProjectStore.getState().canRedo()).toBe(true);
  });
});
