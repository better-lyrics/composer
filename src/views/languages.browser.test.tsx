import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import { useProjectStore } from "@/stores/project";
import { LanguagesPanel } from "@/views/languages";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

describe("LanguagesPanel", () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
    useProjectStore.getState().setLines([{ id: "l1", text: "こんにちは", agentId: "v1" }]);
    useProjectStore.getState().setActiveTab("languages");
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      const romanization = url.searchParams.getAll("dt").includes("rm");
      const data = romanization
        ? [
            [
              ["こんにちは", "こんにちは", null, null],
              [null, null, "kon-nichiwa", "kon-nichiwa"],
            ],
            null,
            "ja",
          ]
        : [[["Hello", "こんにちは"]], null, "ja"];
      return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("automatically generates editable English and normalized transliteration content on entry", async () => {
    const screen = await render(<LanguagesPanel />);
    await expect.element(screen.getByRole("textbox", { name: "Transliteration" })).toHaveValue("kon-nichiwa");
    await expect.element(screen.getByRole("textbox", { name: "English" })).toHaveValue("Hello");
    expect(useProjectStore.getState().metadata.language).toBe("ja");
  });

  it("does not send structural syllable markers to automatic language generation", async () => {
    useProjectStore.getState().setLines([
      {
        id: "l1",
        text: "今|は 当|然",
        backgroundText: "風|だ",
        backgroundTextSource: "manual",
        agentId: "v1",
      },
    ]);
    const requestedText: string[] = [];
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      const text = url.searchParams.get("q") ?? "";
      requestedText.push(text);
      const romanization = url.searchParams.getAll("dt").includes("rm");
      const generated = text === "今は 当然" ? (romanization ? "ima wa tōzen desu" : "Now, of course") : "kaze da";
      const data = romanization
        ? [
            [
              [text, text, null, null],
              [null, null, generated, generated],
            ],
            null,
            "ja",
          ]
        : [[[generated, text]], null, "ja"];
      return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
    });

    const screen = await render(<LanguagesPanel />);

    await expect
      .element(screen.getByRole("textbox", { name: "Transliteration", exact: true }))
      .toHaveValue("ima-wa tōzen-desu");
    await expect.element(screen.getByRole("textbox", { name: "English", exact: true })).toHaveValue("Now, of course");
    expect(requestedText).toHaveLength(4);
    expect(requestedText.every((text) => !text.includes("|"))).toBe(true);
    expect(new Set(requestedText)).toEqual(new Set(["今は 当然", "風だ"]));
  });

  it("preserves manual alternate text during automatic generation", async () => {
    useProjectStore.getState().setLines([
      {
        id: "l1",
        text: "こんにちは",
        agentId: "v1",
        transliteration: {
          language: "ja-Latn",
          text: "manual romanization",
          segments: [{ original: "こんにちは", transliteration: "manual romanization" }],
          origin: "manual",
          sourceFingerprint: "current",
        },
        translations: {
          en: {
            language: "en",
            text: "Manual translation",
            origin: "manual",
            sourceFingerprint: "current",
          },
        },
      },
    ]);
    const screen = await render(<LanguagesPanel />);
    await expect.poll(() => useProjectStore.getState().lines[0].transliteration?.stale).toBe(true);
    await expect.element(screen.getByRole("textbox", { name: "Transliteration" })).toHaveValue("manual romanization");
    await expect.element(screen.getByRole("textbox", { name: "English" })).toHaveValue("Manual translation");
    const summary = screen.container.querySelector("[data-language-review-summary]");
    expect(summary?.textContent).toContain("1 line needs review");
    expect(summary?.textContent).toContain("Line 1");
    expect(summary?.textContent).toContain("Transliteration · English");
  });

  it("does not mark language tracks stale when syllable splitting only adds structural markers", async () => {
    const sourceFingerprint = languageSourceFingerprint("to-do");
    useProjectStore.getState().setLines([
      {
        id: "l1",
        text: "to-|do",
        agentId: "v1",
        words: [
          { text: "to-", begin: 0, end: 0.5, transliteration: "to", syllableGroupId: "group" },
          { text: "do", begin: 0.5, end: 1, transliteration: "do", syllableGroupId: "group" },
        ],
        transliteration: {
          language: "en-Latn",
          text: "to-do",
          segments: [{ original: "to-do", transliteration: "to-do" }],
          origin: "manual",
          sourceFingerprint,
          stale: true,
        },
        translations: {
          en: {
            language: "en",
            text: "to-do",
            origin: "manual",
            sourceFingerprint,
            stale: true,
          },
        },
      },
    ]);

    await render(<LanguagesPanel />);

    expect(document.body.textContent).not.toContain("Needs review");
    await expect.poll(() => useProjectStore.getState().lines[0].transliteration?.stale).toBeUndefined();
    expect(useProjectStore.getState().lines[0].translations?.en.stale).toBeUndefined();
  });

  it("summarizes transliteration alignment errors and links them to their lines", async () => {
    const sourceFingerprint = languageSourceFingerprint("가|나");
    useProjectStore.getState().setLines([
      {
        id: "l1",
        text: "가|나",
        agentId: "v1",
        words: [
          { text: "가", begin: 0, end: 0.5, syllableGroupId: "group" },
          { text: "나", begin: 0.5, end: 1, syllableGroupId: "group" },
        ],
        transliteration: {
          language: "ko-Latn",
          text: "gana",
          segments: [],
          origin: "manual",
          sourceFingerprint,
        },
      },
    ]);

    const screen = await render(<LanguagesPanel />);

    const summary = screen.container.querySelector("[data-language-alignment-error-summary]");
    expect(summary?.textContent).toContain("1 line has an alignment error");
    expect(summary?.textContent).toContain("Line 1");
    expect(summary?.textContent).toContain("Transliteration");
    await expect
      .element(screen.getByText("Original word 1 is split into 2 timed syllables", { exact: false }))
      .toBeInTheDocument();
    await expect.element(screen.getByText("Error", { exact: true })).toBeInTheDocument();
  });

  it("lets the user override the detected source language", async () => {
    const screen = await render(<LanguagesPanel />);
    const source = screen.getByRole("combobox", { name: "Source language" });
    await expect.element(source).toHaveValue("ja");
    await source.selectOptions("ko");
    await expect.poll(() => useProjectStore.getState().metadata.language).toBe("ko");
  });

  it("preselects the translation language from the field receiving a multiline paste", async () => {
    useProjectStore
      .getState()
      .setLines(["하나", "둘", "셋", "넷"].map((text, index) => ({ id: `l${index}`, text, agentId: "v1" })));
    const screen = await render(<LanguagesPanel />);
    await expect.element(screen.getByRole("textbox", { name: "English" }).first()).toBeInTheDocument();
    const englishField = screen.container.querySelector<HTMLInputElement>('input[data-language-import-language="en"]');
    expect(englishField).not.toBeNull();
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", "One\nTwo\nThree\nFour");
    englishField!.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, clipboardData }));

    await expect.element(screen.getByRole("dialog")).toBeInTheDocument();
    const language = document.querySelector<HTMLSelectElement>('select[aria-label="Imported translation language"]');
    expect(language?.value).toBe("en");
    await expect.element(screen.getByRole("button", { name: "Import translation" })).toBeInTheDocument();
  });
});
