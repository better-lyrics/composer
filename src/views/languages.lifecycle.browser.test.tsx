import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { LyricLine } from "@/domain/line/model";
import { googleLanguageProvider } from "@/services/google-language-provider";
import { useProjectStore } from "@/stores/project";
import { LanguagesPanel } from "@/views/languages";
import { Activity } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

const source = "こんにちは";

function translatedLine(language: string, text: string, id = "line"): LyricLine {
  return {
    id,
    text: source,
    agentId: "v1",
    translations: {
      [language]: { language, text, origin: "manual", sourceFingerprint: languageSourceFingerprint(source) },
    },
  };
}

function ActivityPanel() {
  const activeTab = useProjectStore((state) => state.activeTab);
  return (
    <Activity mode={activeTab === "languages" ? "visible" : "hidden"}>
      <LanguagesPanel />
    </Activity>
  );
}

describe("language generation lifecycle", () => {
  let pending: Array<() => void>;
  let requestedTargets: string[];
  let defer: boolean;

  beforeEach(() => {
    pending = [];
    requestedTargets = [];
    defer = false;
    useProjectStore.getState().setMetadata({ language: "ja" });
    useProjectStore.getState().setLines([{ id: "line", text: source, agentId: "v1" }]);
    useProjectStore.getState().setActiveTab("languages");
    // Deliberately ignore AbortSignal: completion guards must protect the store
    // even if a response has already arrived when the request is cancelled.
    vi.spyOn(googleLanguageProvider, "transliterate").mockImplementation((lines) => {
      const result = {
        detectedLanguage: "ja",
        language: "ja-Latn",
        lines: lines.map((line) => ({
          id: line.id,
          text: "konnichiwa",
          segments: [{ original: line.text, transliteration: "konnichiwa" }],
        })),
      };
      return defer && lines.length > 0
        ? new Promise((resolve) => pending.push(() => resolve(result)))
        : Promise.resolve(result);
    });
    vi.spyOn(googleLanguageProvider, "translate").mockImplementation((lines, language) => {
      if (lines.length > 0) requestedTargets.push(language);
      const result = {
        detectedLanguage: "ja",
        lines: lines.map((line) => ({ id: line.id, text: "Generated translation" })),
      };
      return defer && lines.length > 0
        ? new Promise((resolve) => pending.push(() => resolve(result)))
        : Promise.resolve(result);
    });
  });

  afterEach(() => {
    for (const resolve of pending.splice(0)) resolve();
    vi.restoreAllMocks();
  });

  async function releaseRequests() {
    for (const resolve of pending.splice(0)) resolve();
    await expect.poll(() => pending.length).toBe(0);
  }

  it("keeps translation and transliteration edits made during forced regeneration", async () => {
    const screen = await render(<LanguagesPanel />);
    const english = screen.getByRole("textbox", { name: "English", exact: true });
    const roman = screen.getByRole("textbox", { name: "Transliteration", exact: true });
    await expect.element(english).toHaveValue("Generated translation");
    defer = true;
    await screen.getByRole("button", { name: "Regenerate all", exact: true }).click();
    await expect.poll(() => pending.length).toBe(2);
    await english.fill("New manual translation");
    await roman.fill("New manual romanization");
    await releaseRequests();
    await expect.element(screen.getByRole("button", { name: "Regenerate all", exact: true })).toBeEnabled();
    await expect.element(english).toHaveValue("New manual translation");
    await expect.element(roman).toHaveValue("New manual romanization");
  });

  it("does not recreate a target removed while generation is pending", async () => {
    defer = true;
    const screen = await render(<LanguagesPanel />);
    await expect.poll(() => pending.length).toBe(2);
    await screen.getByRole("button", { name: "Remove en", exact: true }).click();
    await releaseRequests();
    await expect.element(screen.getByRole("button", { name: "Regenerate all", exact: true })).toBeEnabled();
    expect(useProjectStore.getState().lines[0].translations?.en).toBeUndefined();
    await expect.element(screen.getByRole("button", { name: "Remove en", exact: true })).not.toBeInTheDocument();
  });

  it("preserves text typed and then cleared while initial generation is pending", async () => {
    defer = true;
    const screen = await render(<LanguagesPanel />);
    await expect.poll(() => pending.length).toBe(2);
    const english = screen.getByRole("textbox", { name: "English", exact: true });
    const roman = screen.getByRole("textbox", { name: "Transliteration", exact: true });
    await english.fill("Temporary translation");
    await english.fill("");
    await roman.fill("Temporary romanization");
    await roman.fill("");
    await releaseRequests();
    await expect.element(screen.getByRole("button", { name: "Regenerate all", exact: true })).toBeEnabled();
    await expect.element(english).toHaveValue("");
    await expect.element(roman).toHaveValue("");
    expect(useProjectStore.getState().lines[0].translations?.en).toBeUndefined();
    expect(useProjectStore.getState().lines[0].transliteration).toBeUndefined();
  });

  it("discards generated results if the source was edited during the request", async () => {
    useProjectStore.getState().setMetadata({ language: undefined });
    defer = true;
    const screen = await render(<LanguagesPanel />);
    await expect.poll(() => pending.length).toBe(2);
    useProjectStore.getState().updateLine("line", { text: "別の歌詞" });
    await releaseRequests();
    await expect.element(screen.getByRole("button", { name: "Regenerate all", exact: true })).toBeEnabled();
    expect(useProjectStore.getState().lines[0].translations).toBeUndefined();
    expect(useProjectStore.getState().lines[0].transliteration).toBeUndefined();
    expect(useProjectStore.getState().metadata.language).toBeUndefined();
  });

  it("starts a new batch for a replacement project without committing the old pending batch", async () => {
    defer = true;
    const screen = await render(<LanguagesPanel />);
    await expect.poll(() => pending.length).toBe(2);
    const oldRequests = pending.splice(0);
    useProjectStore.getState().setLines([translatedLine("es", "Hola", "replacement")]);
    await expect.poll(() => pending.length).toBe(3);
    await expect.element(screen.getByRole("textbox", { name: "Spanish", exact: true })).toHaveValue("Hola");
    for (const resolve of oldRequests) resolve();
    await releaseRequests();
    await expect.element(screen.getByRole("button", { name: "Regenerate all", exact: true })).toBeEnabled();
    expect(useProjectStore.getState().lines.map((line) => line.id)).toEqual(["replacement"]);
    await expect.element(screen.getByRole("textbox", { name: "Spanish", exact: true })).toHaveValue("Hola");
    await expect
      .element(screen.getByRole("textbox", { name: "English", exact: true }))
      .toHaveValue("Generated translation");
  });

  it("resynchronizes imported target languages while Activity is hidden, including reused line IDs", async () => {
    useProjectStore.getState().setLines([translatedLine("fr", "Bonjour")]);
    const screen = await render(<ActivityPanel />);
    await expect
      .element(screen.getByRole("textbox", { name: "English", exact: true }))
      .toHaveValue("Generated translation");
    useProjectStore.getState().setActiveTab("edit");
    await expect.element(screen.getByRole("textbox", { name: "French", exact: true })).not.toBeInTheDocument();
    useProjectStore.getState().startProjectSession();
    useProjectStore.getState().setLines([translatedLine("es", "Hola")]);
    requestedTargets = [];
    useProjectStore.getState().setActiveTab("languages");
    await expect.element(screen.getByRole("textbox", { name: "Spanish", exact: true })).toHaveValue("Hola");
    await expect.poll(() => requestedTargets.includes("es")).toBe(true);
    expect(requestedTargets).not.toContain("fr");
    await expect.element(screen.getByRole("button", { name: "Remove fr", exact: true })).not.toBeInTheDocument();
  });

  it("keeps a translation target editable after its last stored translation is cleared", async () => {
    const screen = await render(<LanguagesPanel />);
    const english = screen.getByRole("textbox", { name: "English", exact: true });
    await expect.element(english).toHaveValue("Generated translation");
    await english.fill("");
    await expect.element(english).toHaveValue("");
    await expect.element(screen.getByRole("button", { name: "Remove en", exact: true })).toBeInTheDocument();
    await english.fill("Replacement manual translation");
    await expect.element(english).toHaveValue("Replacement manual translation");
  });

  it("resets empty target choices when a session reloads the same line IDs and track languages", async () => {
    const screen = await render(<ActivityPanel />);
    await expect
      .element(screen.getByRole("textbox", { name: "English", exact: true }))
      .toHaveValue("Generated translation");
    await screen.getByRole("button", { name: "Remove en", exact: true }).click();
    defer = true;
    await screen.getByRole("button", { name: "Add translation", exact: true }).click();
    await expect.poll(() => pending.length).toBe(2);
    useProjectStore.getState().setActiveTab("edit");
    await expect.element(screen.getByRole("button", { name: "Remove es", exact: true })).not.toBeInTheDocument();
    useProjectStore.getState().startProjectSession();
    useProjectStore.getState().setLines([{ id: "line", text: source, agentId: "v1" }]);
    await releaseRequests();
    defer = false;
    requestedTargets = [];
    useProjectStore.getState().setActiveTab("languages");
    await expect
      .element(screen.getByRole("textbox", { name: "English", exact: true }))
      .toHaveValue("Generated translation");
    expect(requestedTargets).toEqual(["en"]);
    await expect.element(screen.getByRole("button", { name: "Remove es", exact: true })).not.toBeInTheDocument();
  });

  it("retains a removed default target and an empty selected target across Activity re-entry", async () => {
    const screen = await render(<ActivityPanel />);
    await expect
      .element(screen.getByRole("textbox", { name: "English", exact: true }))
      .toHaveValue("Generated translation");
    await screen.getByRole("button", { name: "Remove en", exact: true }).click();
    defer = true;
    await screen.getByRole("button", { name: "Add translation", exact: true }).click();
    await expect.poll(() => pending.length).toBe(2);
    useProjectStore.getState().setActiveTab("edit");
    await expect.element(screen.getByRole("button", { name: "Remove es", exact: true })).not.toBeInTheDocument();
    await releaseRequests();
    defer = false;
    requestedTargets = [];
    useProjectStore.getState().setActiveTab("languages");
    await expect
      .element(screen.getByRole("textbox", { name: "Spanish", exact: true }))
      .toHaveValue("Generated translation");
    expect(requestedTargets).toEqual(["es"]);
    expect(useProjectStore.getState().lines[0].translations?.en).toBeUndefined();
  });

  it("restarts generation on Activity re-entry and ignores an older cancelled response", async () => {
    defer = true;
    const screen = await render(<ActivityPanel />);
    await expect.poll(() => pending.length).toBe(2);
    const oldRequests = pending.splice(0);
    useProjectStore.getState().setActiveTab("edit");
    await expect.element(screen.getByRole("textbox", { name: "English", exact: true })).not.toBeInTheDocument();
    useProjectStore.getState().setActiveTab("languages");
    await expect.poll(() => pending.length).toBe(2);
    await screen.getByRole("textbox", { name: "English", exact: true }).fill("Edited after re-entry");
    for (const resolve of oldRequests) resolve();
    await releaseRequests();
    await expect.element(screen.getByRole("button", { name: "Regenerate all", exact: true })).toBeEnabled();
    await expect
      .element(screen.getByRole("textbox", { name: "English", exact: true }))
      .toHaveValue("Edited after re-entry");
  });
});
