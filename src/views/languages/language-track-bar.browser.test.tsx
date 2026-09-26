import { render } from "@/test/render";
import { LanguageTrackBar } from "@/views/languages/language-track-bar";
import { userEvent } from "vitest/browser";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const NAMES = new Map([
  ["en", "English"],
  ["es", "Spanish"],
  ["fr", "French"],
]);
const AVAILABLE = [["fr", "French"]] as const;

// -- Tests --------------------------------------------------------------------

describe("LanguageTrackBar", () => {
  it("shows a transliteration chip with formatting help and one chip per target", async () => {
    const screen = await render(
      <LanguageTrackBar
        targets={["en", "es"]}
        languageNames={NAMES}
        availableLanguages={AVAILABLE}
        disabled={false}
        onAdd={() => {}}
        onRemove={() => {}}
      />,
    );
    await expect.element(screen.getByText("Transliteration")).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Transliteration formatting help" })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Remove English" })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Remove Spanish" })).toBeInTheDocument();
  });

  it("removes a target by name", async () => {
    const removed: string[] = [];
    const screen = await render(
      <LanguageTrackBar
        targets={["en"]}
        languageNames={NAMES}
        availableLanguages={AVAILABLE}
        disabled={false}
        onAdd={() => {}}
        onRemove={(language) => removed.push(language)}
      />,
    );
    await screen.getByRole("button", { name: "Remove English" }).click();
    expect(removed).toEqual(["en"]);
  });

  it("adds a language picked from the menu", async () => {
    const added: string[] = [];
    const screen = await render(
      <LanguageTrackBar
        targets={["en"]}
        languageNames={NAMES}
        availableLanguages={AVAILABLE}
        disabled={false}
        onAdd={(language) => added.push(language)}
        onRemove={() => {}}
      />,
    );
    await screen.getByRole("button", { name: "Add language" }).click();
    await screen.getByRole("option", { name: "French" }).click();
    expect(added).toEqual(["fr"]);
  });

  describe("edge cases", () => {
    it("disables adding while generating", async () => {
      const screen = await render(
        <LanguageTrackBar
          targets={[]}
          languageNames={NAMES}
          availableLanguages={AVAILABLE}
          disabled
          onAdd={() => {}}
          onRemove={() => {}}
        />,
      );
      await expect.element(screen.getByRole("button", { name: "Add language" })).toBeDisabled();
    });

    it("hides the add menu when every language is already a target", async () => {
      const screen = await render(
        <LanguageTrackBar
          targets={["fr"]}
          languageNames={NAMES}
          availableLanguages={[]}
          disabled={false}
          onAdd={() => {}}
          onRemove={() => {}}
        />,
      );
      expect(screen.container.querySelector('button[aria-haspopup="listbox"]')).toBeNull();
    });

    it("falls back to the language code when no name is known", async () => {
      const screen = await render(
        <LanguageTrackBar
          targets={["xx"]}
          languageNames={NAMES}
          availableLanguages={[]}
          disabled={false}
          onAdd={() => {}}
          onRemove={() => {}}
        />,
      );
      await expect.element(screen.getByRole("button", { name: "Remove xx" })).toBeInTheDocument();
    });
  });

  describe("keyboard", () => {
    it("removes a target with Enter", async () => {
      const removed: string[] = [];
      const screen = await render(
        <LanguageTrackBar
          targets={["en"]}
          languageNames={NAMES}
          availableLanguages={AVAILABLE}
          disabled={false}
          onAdd={() => {}}
          onRemove={(language) => removed.push(language)}
        />,
      );
      (screen.getByRole("button", { name: "Remove English" }).element() as HTMLButtonElement).focus();
      await userEvent.keyboard("{Enter}");
      expect(removed).toEqual(["en"]);
    });

    it("opens the add menu with Enter and closes it with Escape", async () => {
      const added: string[] = [];
      const screen = await render(
        <LanguageTrackBar
          targets={["en"]}
          languageNames={NAMES}
          availableLanguages={AVAILABLE}
          disabled={false}
          onAdd={(language) => added.push(language)}
          onRemove={() => {}}
        />,
      );
      (screen.getByRole("button", { name: "Add language" }).element() as HTMLButtonElement).focus();
      await userEvent.keyboard("{Enter}");
      await expect.element(screen.getByRole("option", { name: "French" })).toBeInTheDocument();
      await userEvent.keyboard("{Escape}");
      await expect.element(screen.getByRole("option", { name: "French" })).not.toBeInTheDocument();
      expect(added).toEqual([]);
    });
  });
});
