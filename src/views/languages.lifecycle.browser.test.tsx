import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { LyricLine } from "@/domain/line/model";
import { googleLanguageProvider } from "@/services/google-language-provider";
import { useProjectStore } from "@/stores/project";
import { LanguagesPanel } from "@/views/languages";
import { Activity } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";

const source = "こんにちは";
const GENERATE_ALL = /^(Generate|Regenerate) all$/;

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
  let transliterationRequests: number;
  let defer: boolean;

  beforeEach(() => {
    pending = [];
    requestedTargets = [];
    transliterationRequests = 0;
    defer = false;
    useProjectStore.getState().setMetadata({ language: "ja" });
    useProjectStore.getState().setLines([{ id: "line", text: source, agentId: "v1" }]);
    useProjectStore.getState().setActiveTab("languages");
    // Deliberately ignore AbortSignal: completion guards must protect the store
    // even if a response has already arrived when the request is cancelled.
    vi.spyOn(googleLanguageProvider, "transliterate").mockImplementation((lines) => {
      if (lines.length > 0) transliterationRequests += 1;
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

  async function addLanguage(screen: Awaited<ReturnType<typeof render>>, name: string) {
    await screen.getByRole("button", { name: "Add language", exact: true }).click();
    await screen.getByRole("option", { name }).click();
  }

  function regenerateAll(screen: Awaited<ReturnType<typeof render>>) {
    return screen.getByRole("button", { name: GENERATE_ALL }).click();
  }

  it("regression: opening the tab never asks Google or writes the project", async () => {
    const history = useProjectStore.getState().history;
    const screen = await render(<ActivityPanel />);
    const english = screen.getByRole("textbox", { name: "English", exact: true });
    await expect.element(english).toHaveValue("");
    useProjectStore.getState().setActiveTab("edit");
    useProjectStore.getState().setActiveTab("languages");
    await expect.element(english).toHaveValue("");

    expect(transliterationRequests).toBe(0);
    expect(requestedTargets).toEqual([]);
    expect(useProjectStore.getState().lines[0].translations).toBeUndefined();
    expect(useProjectStore.getState().history).toBe(history);
    await expect.element(screen.getByRole("button", { name: "Generate all", exact: true })).toBeInTheDocument();
  });

  it("keeps translation and transliteration edits made during forced regeneration", async () => {
    const screen = await render(<LanguagesPanel />);
    const english = screen.getByRole("textbox", { name: "English", exact: true });
    const roman = screen.getByRole("textbox", { name: "Transliteration", exact: true });
    await regenerateAll(screen);
    await expect.element(english).toHaveValue("Generated translation");
    defer = true;
    await regenerateAll(screen);
    await expect.poll(() => pending.length).toBe(2);
    await english.fill("New manual translation");
    await roman.fill("New manual romanization");
    await releaseRequests();
    await expect.element(screen.getByRole("button", { name: GENERATE_ALL })).toBeEnabled();
    await expect.element(english).toHaveValue("New manual translation");
    await expect.element(roman).toHaveValue("New manual romanization");
  });

  it("does not recreate a target removed while generation is pending", async () => {
    defer = true;
    const screen = await render(<LanguagesPanel />);
    await regenerateAll(screen);
    await expect.poll(() => pending.length).toBe(2);
    await screen.getByRole("button", { name: "Remove English", exact: true }).click();
    await releaseRequests();
    await expect.element(screen.getByRole("button", { name: GENERATE_ALL })).toBeEnabled();
    expect(useProjectStore.getState().lines[0].translations?.en).toBeUndefined();
    await expect.element(screen.getByRole("button", { name: "Remove English", exact: true })).not.toBeInTheDocument();
  });

  it("regression: adding a language through Add language requests generation only for that target", async () => {
    const screen = await render(<LanguagesPanel />);
    await addLanguage(screen, "Spanish");
    await expect
      .element(screen.getByRole("textbox", { name: "Spanish", exact: true }))
      .toHaveValue("Generated translation");
    expect(requestedTargets).toEqual(["es"]);
  });

  it("preserves text typed and then cleared while generation is pending", async () => {
    defer = true;
    const screen = await render(<LanguagesPanel />);
    await regenerateAll(screen);
    await expect.poll(() => pending.length).toBe(2);
    const english = screen.getByRole("textbox", { name: "English", exact: true });
    const roman = screen.getByRole("textbox", { name: "Transliteration", exact: true });
    await english.fill("Temporary translation");
    await english.fill("");
    await roman.fill("Temporary romanization");
    await roman.fill("");
    await releaseRequests();
    await expect.element(screen.getByRole("button", { name: GENERATE_ALL })).toBeEnabled();
    await expect.element(english).toHaveValue("");
    await expect.element(roman).toHaveValue("");
    expect(useProjectStore.getState().lines[0].translations?.en).toBeUndefined();
    expect(useProjectStore.getState().lines[0].transliteration).toBeUndefined();
  });

  it("discards generated results if the source was edited during the request", async () => {
    useProjectStore.getState().setMetadata({ language: undefined });
    defer = true;
    const screen = await render(<LanguagesPanel />);
    await regenerateAll(screen);
    await expect.poll(() => pending.length).toBe(2);
    useProjectStore.getState().updateLine("line", { text: "別の歌詞" });
    await releaseRequests();
    await expect.element(screen.getByRole("button", { name: GENERATE_ALL })).toBeEnabled();
    expect(useProjectStore.getState().lines[0].translations).toBeUndefined();
    expect(useProjectStore.getState().lines[0].transliteration).toBeUndefined();
    expect(useProjectStore.getState().metadata.language).toBeUndefined();
  });

  it("never commits an old project's pending batch into a replacement project", async () => {
    defer = true;
    const screen = await render(<LanguagesPanel />);
    await regenerateAll(screen);
    await expect.poll(() => pending.length).toBe(2);
    useProjectStore.getState().setLines([translatedLine("es", "Hola", "replacement")]);
    await expect.element(screen.getByRole("textbox", { name: "Spanish", exact: true })).toHaveValue("Hola");
    await releaseRequests();
    await expect.element(screen.getByRole("button", { name: GENERATE_ALL })).toBeEnabled();
    expect(useProjectStore.getState().lines.map((line) => line.id)).toEqual(["replacement"]);
    await expect.element(screen.getByRole("textbox", { name: "Spanish", exact: true })).toHaveValue("Hola");
    await expect.element(screen.getByRole("textbox", { name: "English", exact: true })).toHaveValue("");
  });

  it("resynchronizes imported target languages while Activity is hidden, including reused line IDs", async () => {
    useProjectStore.getState().setLines([translatedLine("fr", "Bonjour")]);
    const screen = await render(<ActivityPanel />);
    await expect.element(screen.getByRole("textbox", { name: "French", exact: true })).toHaveValue("Bonjour");
    useProjectStore.getState().setActiveTab("edit");
    await expect.element(screen.getByRole("textbox", { name: "French", exact: true })).not.toBeInTheDocument();
    useProjectStore.getState().startProjectSession();
    useProjectStore.getState().setLines([translatedLine("es", "Hola")]);
    useProjectStore.getState().setActiveTab("languages");
    await expect.element(screen.getByRole("textbox", { name: "Spanish", exact: true })).toHaveValue("Hola");
    await expect.element(screen.getByRole("button", { name: "Remove French", exact: true })).not.toBeInTheDocument();
    expect(requestedTargets).toEqual([]);
  });

  it("keeps a translation target editable after its last stored translation is cleared", async () => {
    const screen = await render(<LanguagesPanel />);
    const english = screen.getByRole("textbox", { name: "English", exact: true });
    await regenerateAll(screen);
    await expect.element(english).toHaveValue("Generated translation");
    await english.fill("");
    await expect.element(english).toHaveValue("");
    await expect.element(screen.getByRole("button", { name: "Remove English", exact: true })).toBeInTheDocument();
    await english.fill("Replacement manual translation");
    await expect.element(english).toHaveValue("Replacement manual translation");
  });

  it("resets empty target choices when a session reloads the same line IDs and track languages", async () => {
    const screen = await render(<ActivityPanel />);
    await screen.getByRole("button", { name: "Remove English", exact: true }).click();
    defer = true;
    await addLanguage(screen, "Spanish");
    await expect.poll(() => pending.length).toBe(2);
    useProjectStore.getState().setActiveTab("edit");
    await expect.element(screen.getByRole("button", { name: "Remove Spanish", exact: true })).not.toBeInTheDocument();
    useProjectStore.getState().startProjectSession();
    useProjectStore.getState().setLines([{ id: "line", text: source, agentId: "v1" }]);
    await releaseRequests();
    requestedTargets = [];
    useProjectStore.getState().setActiveTab("languages");
    await expect.element(screen.getByRole("textbox", { name: "English", exact: true })).toHaveValue("");
    await expect.element(screen.getByRole("button", { name: "Remove Spanish", exact: true })).not.toBeInTheDocument();
    expect(requestedTargets).toEqual([]);
  });

  it("retains a removed default target and an empty selected target across Activity re-entry", async () => {
    const screen = await render(<ActivityPanel />);
    await screen.getByRole("button", { name: "Remove English", exact: true }).click();
    defer = true;
    await addLanguage(screen, "Spanish");
    await expect.poll(() => pending.length).toBe(2);
    useProjectStore.getState().setActiveTab("edit");
    await expect.element(screen.getByRole("button", { name: "Remove Spanish", exact: true })).not.toBeInTheDocument();
    await releaseRequests();
    requestedTargets = [];
    useProjectStore.getState().setActiveTab("languages");
    await expect.element(screen.getByRole("textbox", { name: "Spanish", exact: true })).toHaveValue("");
    await expect.element(screen.getByRole("textbox", { name: "English", exact: true })).not.toBeInTheDocument();
    expect(requestedTargets).toEqual([]);
    expect(useProjectStore.getState().lines[0].translations).toBeUndefined();
  });
});
