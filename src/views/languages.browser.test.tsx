import { alignTrackToLine, mappedTransliteration } from "@/domain/language/align";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { TransliterationTrack } from "@/domain/language/model";
import { type LyricLine, reconcileLine } from "@/domain/line/model";
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
    await expect.element(screen.getByRole("textbox", { name: "Transliteration" })).toHaveValue("kon nichiwa");
    await expect.element(screen.getByRole("textbox", { name: "English" })).toHaveValue("Hello");
    expect(useProjectStore.getState().metadata.language).toBe("ja");
  });

  it("replaces an edited translation on a mixed-script line when regenerating all", async () => {
    const sourceText = '꽉 찬 내 to-|do list, I say, "What are those?"';
    const generatedEnglish = "My to-do list is full, I say, “What are those?”";
    useProjectStore.getState().setMetadata({ language: "ko" });
    useProjectStore.getState().setLines([{ id: "mixed-regeneration", text: sourceText, agentId: "v1" }]);
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      expect(url.searchParams.get("sl")).toBe("ko");
      const source = url.searchParams.get("q") ?? "";
      const romanization = url.searchParams.getAll("dt").includes("rm");
      const generated = romanization ? "kkwak chan nae to-do list" : generatedEnglish;
      const data = romanization
        ? [
            [
              [source, source, null, null],
              [null, null, generated, generated],
            ],
            null,
            "ko",
          ]
        : [[[generated, source]], null, "ko"];
      return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
    });

    const screen = await render(<LanguagesPanel />);
    const english = screen.getByRole("textbox", { name: "English" });
    await expect.element(english).toHaveValue(generatedEnglish);
    await english.fill(`${generatedEnglish} test`);
    await expect.element(english).toHaveValue(`${generatedEnglish} test`);

    await screen.getByRole("button", { name: "Regenerate all" }).click();

    await expect.element(english).toHaveValue(generatedEnglish);
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
      .toHaveValue("ima  wa  tōzen  desu");
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
          text: "g",
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
      .element(screen.getByText("Original word 1 has more timed parts", { exact: false }))
      .toBeInTheDocument();
    await expect.element(screen.getByText("Error", { exact: true })).toBeInTheDocument();
  });

  it("lets a reviewable inferred mapping be confirmed in the focused alignment editor", async () => {
    const line: LyricLine = {
      id: "l1",
      text: "붙|어|있|던",
      agentId: "v1",
      words: ["붙", "어", "있", "던"].map((text, index) => ({
        text,
        begin: index * 0.25,
        end: (index + 1) * 0.25,
        syllableGroupId: "group",
      })),
    };
    const track: TransliterationTrack = {
      language: "ko-Latn",
      text: "but eoissdeon",
      segments: [{ original: "붙어있던", transliteration: "but eoissdeon" }],
      origin: "manual",
      sourceFingerprint: languageSourceFingerprint(line.text),
    };
    useProjectStore.getState().setLines([reconcileLine({ ...line, ...alignTrackToLine(line, track) })]);

    const screen = await render(<LanguagesPanel />);
    await expect.element(screen.getByText("Review", { exact: true })).toBeInTheDocument();
    await screen.getByRole("button", { name: "Align timing" }).click();
    await expect.element(screen.getByRole("dialog", { name: "Align transliteration" })).toBeInTheDocument();
    await expect.element(screen.getByRole("combobox", { name: "Original word to align" })).toHaveValue("0");
    await screen.getByRole("button", { name: "Save alignment" }).click();

    const saved = useProjectStore.getState().lines[0];
    expect(saved.transliteration?.alignmentStatus).toBe("confirmed");
    expect(mappedTransliteration(saved.words ?? [])).toBe("but eoissdeon");
  });

  it("lets the user override the detected source language", async () => {
    const screen = await render(<LanguagesPanel />);
    const source = screen.getByRole("combobox", { name: "Source language" });
    await expect.element(source).toHaveValue("ja");
    await source.selectOptions("ko");
    await expect.poll(() => useProjectStore.getState().metadata.language).toBe("ko");
  });

  it("selectively regenerates transliteration or individual translations", async () => {
    const text = "選択再生成";
    const fingerprint = languageSourceFingerprint(text);
    useProjectStore.getState().setMetadata({ language: "ja" });
    useProjectStore.getState().setLines([
      {
        id: "selective-regeneration",
        text,
        agentId: "v1",
        transliteration: {
          language: "ja-Latn",
          text: "Edited reading",
          segments: [{ original: text, transliteration: "Edited reading" }],
          origin: "manual",
          sourceFingerprint: fingerprint,
        },
        translations: {
          en: {
            language: "en",
            text: "Edited English",
            origin: "manual",
            sourceFingerprint: fingerprint,
          },
          es: {
            language: "es",
            text: "Edited Spanish",
            origin: "manual",
            sourceFingerprint: fingerprint,
          },
        },
      },
    ]);
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      const romanization = url.searchParams.getAll("dt").includes("rm");
      const target = url.searchParams.get("tl");
      const generated = romanization ? "sentaku-saisei" : target === "es" ? "Español generado" : "Generated English";
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
    await expect.element(screen.getByRole("textbox", { name: "Spanish" })).toHaveValue("Edited Spanish");

    await screen.getByRole("button", { name: "Choose what to regenerate" }).click();
    await screen.getByRole("checkbox", { name: "Transliteration" }).click();
    await screen.getByRole("checkbox", { name: "English" }).click();
    await screen.getByRole("button", { name: "Regenerate selected" }).click();

    await expect.element(screen.getByRole("textbox", { name: "Spanish" })).toHaveValue("Español generado");
    await expect.element(screen.getByRole("textbox", { name: "English" })).toHaveValue("Edited English");
    await expect.element(screen.getByRole("textbox", { name: "Transliteration" })).toHaveValue("Edited reading");
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
