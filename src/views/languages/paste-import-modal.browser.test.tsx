import { validateTransliterationAlignment } from "@/domain/language/align";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { PasteImportModal } from "@/views/languages/paste-import-modal";
import { userEvent } from "vitest/browser";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";

// -- Fixtures -------------------------------------------------------------------

const LANGUAGE_OPTIONS = [
  ["en", "English"],
  ["es", "Spanish"],
] as const;

type Props = React.ComponentProps<typeof PasteImportModal>;

function buildProps(overrides: Partial<Props> & Pick<Props, "lines">): Props {
  useProjectStore.setState({ lines: overrides.lines });
  return {
    isOpen: true,
    initialText: "",
    sourceLanguage: "ko",
    languageOptions: LANGUAGE_OPTIONS,
    defaultTargetLanguage: "en",
    defaultKind: "transliteration",
    onClose: vi.fn(),
    onImportedTranslation: vi.fn(),
    ...overrides,
  };
}

// -- Tests ------------------------------------------------------------------

describe("PasteImportModal", () => {
  it("imports pasted text as transliteration", async () => {
    const lines = [createLine({ id: "l0", text: "Hello" }), createLine({ id: "l1", text: "World" })];
    const props = buildProps({ lines, initialText: "Bonjour\nMonde" });
    const screen = await render(<PasteImportModal {...props} />);

    await expect.element(screen.getByRole("dialog", { name: "Import pasted lines" })).toBeInTheDocument();
    await expect.element(screen.getByText("Blank lines kept")).toBeInTheDocument();
    await screen.getByRole("button", { name: "Import 2 lines" }).click();

    expect(props.onClose).toHaveBeenCalledTimes(1);
    const updated = useProjectStore.getState().lines;
    expect(updated.find((line) => line.id === "l0")?.transliteration).toMatchObject({
      language: "ko-Latn",
      text: "Bonjour",
    });
    expect(updated.find((line) => line.id === "l1")?.transliteration).toMatchObject({ text: "Monde" });
    const fired = toast.getHistory();
    expect(fired.some((entry) => "title" in entry && entry.title === "Imported 2 lines")).toBe(true);
  });

  it("imports pasted text as a translation and notifies the parent", async () => {
    const lines = [createLine({ id: "l0", text: "Hello" }), createLine({ id: "l1", text: "World" })];
    const props = buildProps({
      lines,
      initialText: "Bonjour\nMonde",
      defaultKind: "translation",
      defaultTargetLanguage: "en",
    });
    const screen = await render(<PasteImportModal {...props} />);

    await expect
      .element(screen.getByRole("button", { name: "Imported translation language" }))
      .toHaveTextContent("English");
    await screen.getByRole("button", { name: "Import 2 lines" }).click();

    expect(props.onImportedTranslation).toHaveBeenCalledWith("en");
    const updated = useProjectStore.getState().lines;
    expect(updated.find((line) => line.id === "l0")?.translations?.en).toMatchObject({ text: "Bonjour" });
  });

  it("switches between transliteration and translation controls", async () => {
    const lines = [createLine({ id: "l0", text: "Hello" })];
    const props = buildProps({ lines, defaultKind: "transliteration" });
    const screen = await render(<PasteImportModal {...props} />);

    await expect.element(screen.getByRole("button", { name: "Imported translation language" })).not.toBeInTheDocument();
    await screen.getByRole("button", { name: "Translation", exact: true }).click();
    await expect.element(screen.getByRole("button", { name: "Imported translation language" })).toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: "Translation", exact: true }))
      .toHaveAttribute("aria-pressed", "true");

    await screen.getByRole("button", { name: "Transliteration", exact: true }).click();
    await expect.element(screen.getByRole("button", { name: "Imported translation language" })).not.toBeInTheDocument();
  });

  it("changes the target language from the select and uses it on import", async () => {
    const lines = [createLine({ id: "l0", text: "Hello" })];
    const props = buildProps({
      lines,
      initialText: "Bonjour",
      defaultKind: "translation",
      defaultTargetLanguage: "es",
    });
    const screen = await render(<PasteImportModal {...props} />);

    await expect
      .element(screen.getByRole("button", { name: "Imported translation language" }))
      .toHaveTextContent("Spanish");
    await screen.getByRole("button", { name: "Imported translation language" }).click();
    await screen.getByRole("option", { name: "English" }).click();
    await expect
      .element(screen.getByRole("button", { name: "Imported translation language" }))
      .toHaveTextContent("English");

    await screen.getByRole("button", { name: "Import 1 line" }).click();
    expect(props.onImportedTranslation).toHaveBeenCalledWith("en");
    const updated = useProjectStore.getState().lines;
    expect(updated.find((line) => line.id === "l0")?.translations?.en).toMatchObject({ text: "Bonjour" });
    expect(updated.find((line) => line.id === "l0")?.translations?.es).toBeUndefined();
  });

  it("shows a positive chip and drops blank source lines when pasted rows are shorter", async () => {
    const lines = [
      createLine({ id: "l0", text: "Hello" }),
      createLine({ id: "l1", text: "" }),
      createLine({ id: "l2", text: "World" }),
    ];
    const props = buildProps({ lines, initialText: "Bonjour\nMonde" });
    const screen = await render(<PasteImportModal {...props} />);

    await expect.element(screen.getByText("Blank lines dropped")).toBeInTheDocument();
    expect(document.querySelector('[data-tone="positive"]')?.textContent).toContain("Blank lines dropped");
    await screen.getByRole("button", { name: "Import 2 lines" }).click();

    const updated = useProjectStore.getState().lines;
    expect(updated.find((line) => line.id === "l0")?.transliteration).toMatchObject({ text: "Bonjour" });
    expect(updated.find((line) => line.id === "l2")?.transliteration).toMatchObject({ text: "Monde" });
    expect(updated.find((line) => line.id === "l1")?.transliteration).toBeUndefined();
  });

  it("shows a warning chip for a manual mapping and lets the user fix it before importing", async () => {
    const lines = [
      createLine({ id: "l0", text: "One" }),
      createLine({ id: "l1", text: "Two" }),
      createLine({ id: "l2", text: "Three" }),
    ];
    const props = buildProps({ lines, initialText: "A\nB" });
    const screen = await render(<PasteImportModal {...props} />);

    await expect.element(screen.getByText("Match lines by hand")).toBeInTheDocument();
    expect(document.querySelector('[data-tone="warning"]')?.textContent).toContain("Match lines by hand");
    await expect
      .element(screen.getByText("You pasted 2 lines for 3 lyric lines. Fix the matches below before importing."))
      .toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Import 2 lines" })).toBeInTheDocument();

    await screen.getByRole("textbox", { name: "Imported line 3" }).fill("C");
    await screen.getByRole("button", { name: "Import 3 lines" }).click();

    const updated = useProjectStore.getState().lines;
    expect(updated.find((line) => line.id === "l2")?.transliteration).toMatchObject({ text: "C" });
  });

  describe("edge cases", () => {
    it("disables importing when the pasted text is empty", async () => {
      const lines = [createLine({ id: "l0", text: "Hello" }), createLine({ id: "l1", text: "World" })];
      const props = buildProps({ lines, initialText: "" });
      const screen = await render(<PasteImportModal {...props} />);

      await expect
        .element(screen.getByText("You pasted 0 lines for 2 lyric lines. Fix the matches below before importing."))
        .toBeInTheDocument();
      await expect.element(screen.getByRole("button", { name: "Import 0 lines" })).toBeDisabled();
    });

    it("only maps the rows it received when fewer lines are pasted than lyric lines", async () => {
      const lines = [
        createLine({ id: "l0", text: "Alpha" }),
        createLine({ id: "l1", text: "Beta" }),
        createLine({ id: "l2", text: "Gamma" }),
      ];
      const props = buildProps({ lines, initialText: "Uno" });
      const screen = await render(<PasteImportModal {...props} />);

      await screen.getByRole("button", { name: "Import 1 line" }).click();
      const updated = useProjectStore.getState().lines;
      expect(updated.find((line) => line.id === "l0")?.transliteration).toMatchObject({ text: "Uno" });
      expect(updated.find((line) => line.id === "l1")?.transliteration).toBeUndefined();
      expect(updated.find((line) => line.id === "l2")?.transliteration).toBeUndefined();
    });

    it("ignores extra pasted rows when more lines are pasted than lyric lines", async () => {
      const lines = [createLine({ id: "l0", text: "Uno" }), createLine({ id: "l1", text: "Dos" })];
      const props = buildProps({ lines, initialText: "A\nB\nC\nD" });
      const screen = await render(<PasteImportModal {...props} />);

      await screen.getByRole("button", { name: "Import 2 lines" }).click();
      const updated = useProjectStore.getState().lines;
      expect(updated.find((line) => line.id === "l0")?.transliteration).toMatchObject({ text: "A" });
      expect(updated.find((line) => line.id === "l1")?.transliteration).toMatchObject({ text: "B" });
    });

    it("disables importing when a transliteration cannot be aligned to its timing", async () => {
      const words = ["가", "나", "다"].map((text, index) => ({ text, begin: index, end: index + 1 }));
      const lines = [createLine({ id: "l0", text: "가나다", words })];
      const expectedError = validateTransliterationAlignment("가나다", "a", lines[0].words);
      expect(expectedError).not.toBeNull();

      const props = buildProps({ lines, initialText: "a" });
      const screen = await render(<PasteImportModal {...props} />);

      await expect.element(screen.getByText(expectedError!)).toBeInTheDocument();
      await expect.element(screen.getByRole("button", { name: "Import 1 line" })).toBeDisabled();
    });
  });

  describe("keyboard", () => {
    it("closes the modal on Escape", async () => {
      const lines = [createLine({ id: "l0", text: "Hello" })];
      const props = buildProps({ lines });
      await render(<PasteImportModal {...props} />);

      await userEvent.keyboard("{Escape}");
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });
  });
});
