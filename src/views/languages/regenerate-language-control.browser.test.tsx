import { render } from "@/test/render";
import type { LanguageGenerationSelection } from "@/views/languages/regenerate-language-control";
import { RegenerateLanguageControl } from "@/views/languages/regenerate-language-control";
import { userEvent } from "vitest/browser";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const NAMES = new Map([
  ["en", "English"],
  ["es", "Spanish"],
]);

async function renderControl(overrides: Partial<{ isGenerating: boolean; translations: string[] }> = {}): Promise<{
  screen: Awaited<ReturnType<typeof render>>;
  selections: LanguageGenerationSelection[];
  allCount: () => number;
}> {
  const selections: LanguageGenerationSelection[] = [];
  let all = 0;
  const screen = await render(
    <RegenerateLanguageControl
      isGenerating={overrides.isGenerating ?? false}
      translations={overrides.translations ?? ["en", "es"]}
      languageNames={NAMES}
      onRegenerateAll={() => {
        all++;
      }}
      onRegenerateSelection={(selection) => selections.push(selection)}
    />,
  );
  return { screen, selections, allCount: () => all };
}

// -- Tests --------------------------------------------------------------------

describe("RegenerateLanguageControl", () => {
  it("regenerates everything from the main button", async () => {
    const { screen, allCount } = await renderControl();
    await screen.getByRole("button", { name: "Regenerate all" }).click();
    expect(allCount()).toBe(1);
  });

  it("counts the checked tracks in the menu button", async () => {
    const { screen } = await renderControl();
    await screen.getByRole("button", { name: "Choose what to regenerate" }).click();
    await expect
      .element(screen.getByText("Only checked tracks get replaced. Your other edits stay."))
      .toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Regenerate 3 tracks" })).toBeInTheDocument();
    await screen.getByRole("checkbox", { name: "Spanish" }).click();
    await expect.element(screen.getByRole("button", { name: "Regenerate 2 tracks" })).toBeInTheDocument();
  });

  it("regenerates only the checked tracks and closes the menu", async () => {
    const { screen, selections } = await renderControl();
    await screen.getByRole("button", { name: "Choose what to regenerate" }).click();
    await screen.getByRole("checkbox", { name: "Transliteration" }).click();
    await screen.getByRole("checkbox", { name: "English" }).click();
    await screen.getByRole("button", { name: "Regenerate 1 track" }).click();
    expect(selections).toEqual([{ transliteration: false, translations: ["es"] }]);
    await expect.element(screen.getByRole("checkbox", { name: "Spanish" })).not.toBeInTheDocument();
  });

  it("toggles a track from the keyboard", async () => {
    const { screen } = await renderControl();
    await screen.getByRole("button", { name: "Choose what to regenerate" }).click();
    const english = screen.getByRole("checkbox", { name: "English" });
    (english.element() as HTMLInputElement).focus();
    await userEvent.keyboard(" ");
    await expect.element(english).not.toBeChecked();
    await expect.element(screen.getByRole("button", { name: "Regenerate 2 tracks" })).toBeInTheDocument();
  });

  describe("edge cases", () => {
    it("disables the menu button when nothing is checked", async () => {
      const { screen } = await renderControl({ translations: [] });
      await screen.getByRole("button", { name: "Choose what to regenerate" }).click();
      await screen.getByRole("checkbox", { name: "Transliteration" }).click();
      await expect.element(screen.getByRole("button", { name: "Regenerate 0 tracks" })).toBeDisabled();
    });

    it("offers only transliteration without translation targets", async () => {
      const { screen } = await renderControl({ translations: [] });
      await screen.getByRole("button", { name: "Choose what to regenerate" }).click();
      expect(screen.container.ownerDocument.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
      await expect.element(screen.getByRole("button", { name: "Regenerate 1 track" })).toBeInTheDocument();
    });

    it("disables both buttons while generating", async () => {
      const { screen } = await renderControl({ isGenerating: true });
      await expect.element(screen.getByRole("button", { name: "Generating…" })).toBeDisabled();
      await expect.element(screen.getByRole("button", { name: "Choose what to regenerate" })).toBeDisabled();
    });
  });

  describe("invariants", () => {
    it("keeps real checkboxes for assistive technology", async () => {
      const { screen } = await renderControl();
      await screen.getByRole("button", { name: "Choose what to regenerate" }).click();
      await expect.element(screen.getByRole("checkbox", { name: "Transliteration" })).toBeChecked();
      await expect.element(screen.getByRole("checkbox", { name: "English" })).toBeChecked();
    });
  });
});
