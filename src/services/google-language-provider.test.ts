import { googleLanguageProvider, normalizeGoogleTransliteration } from "@/services/google-language-provider";
import { generatedLanguageUpdates } from "@/views/languages/generated-language-updates";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Google transliteration normalization", () => {
  it("canonicalizes Google syllable separators while preserving word boundaries", () => {
    expect(normalizeGoogleTransliteration("oh-la—mundo")).toBe("oh la mundo");
  });

  it("collapses repeated separators and whitespace", () => {
    expect(normalizeGoogleTransliteration("  ni--hao   ma ")).toBe("ni hao  ma");
  });
});

describe("Google transliteration script fallback", () => {
  it.each([
    ["zh-Hans", "zh-CN"],
    ["zh-Hant", "zh-TW"],
  ])("preserves the explicit %s variant like its %s provider alias", async (language, googleCode) => {
    const requestedSources: string[] = [];
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      requestedSources.push(url.searchParams.get("sl") ?? "");
      return new Response(JSON.stringify([[[null, null, "ni hao"]], null, "zh"]));
    });
    await googleLanguageProvider.transliterate([{ id: "alias", text: `你好 alias ${language}` }], language);
    await googleLanguageProvider.transliterate([{ id: "code", text: `你好 code ${googleCode}` }], googleCode);
    expect(requestedSources).toEqual([googleCode, googleCode]);
  });

  it("uses Hangul detection when a mixed line is labeled English", async () => {
    const requestedSources: string[] = [];
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      requestedSources.push(url.searchParams.get("sl") ?? "");
      return new Response(
        JSON.stringify([
          [
            ["걸음은 Like a dance", "걸음은 Like a dance", null, null, 5],
            [null, null, "geol-eum-eun Like a dance", "geol-eum-eun Like a dance"],
          ],
          null,
          "ko",
        ]),
      );
    });

    const result = await googleLanguageProvider.transliterate([{ id: "mixed", text: "걸음은 Like a dance" }], "en");

    expect(requestedSources).toEqual(["ko"]);
    expect(result.detectedLanguage).toBe("ko");
    expect(result.lines[0].text).toBe("geol eum eun  Like  a  dance");
    expect(result.lines[0].segments).toEqual([
      { original: "걸음은 Like a dance", transliteration: "geol eum eun  Like  a  dance" },
    ]);
  });

  it("protects literal source dashes while converting generated dashes to spaces", async () => {
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      expect(url.searchParams.get("q")).toBe("붙어\uE000있던");
      return new Response(JSON.stringify([[[null, null, "but-eo\uE000issdeon", "but-eo\uE000issdeon"]], null, "ko"]));
    });

    const result = await googleLanguageProvider.transliterate([{ id: "dash", text: "붙어-있던" }], "ko");
    expect(result.lines[0].text).toBe("but eo-issdeon");
  });
});

describe("Google translation source language", () => {
  it("normalizes Chinese source and target aliases only at the provider boundary", async () => {
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      expect(url.searchParams.get("sl")).toBe("zh-CN");
      expect(url.searchParams.get("tl")).toBe("zh-TW");
      return new Response(JSON.stringify([[["傳統", "传统"]], null, "zh-CN"]));
    });
    const result = await googleLanguageProvider.translate([{ id: "alias", text: "传统" }], "zh-Hant", "zh-Hans");
    expect(result.lines[0].text).toBe("傳統");
  });

  it("uses the selected source language for mixed-script lines", async () => {
    const sourceText = '꽉 찬 내 to-do list, I say, "What are those?"';
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      expect(url.searchParams.get("sl")).toBe("ko");
      expect(url.searchParams.get("tl")).toBe("en");
      return new Response(
        JSON.stringify([[["My to-do list is full, I say, “What are those?”", sourceText]], null, "ko"]),
      );
    });

    const result = await googleLanguageProvider.translate([{ id: "mixed", text: sourceText }], "en", "ko");

    expect(result.lines[0].text).toBe("My to-do list is full, I say, “What are those?”");
  });
});

describe("Google partial request failures", () => {
  it.each(["translate", "transliterate"] as const)(
    "does not cache malformed successful HTTP %s responses or replace existing tracks",
    async (operation) => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const source = `malformed response ${operation}`;
      const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "invalid response" })));
      vi.stubGlobal("fetch", fetchMock);
      const run = () =>
        operation === "translate"
          ? googleLanguageProvider.translate([{ id: "line", text: source }], "en", "en")
          : googleLanguageProvider.transliterate([{ id: "line", text: source }], "en");
      const result = await run();
      expect(result.lines[0]).toMatchObject({ id: "line", text: null, failed: true });
      const line = {
        id: "line",
        agentId: "v1",
        text: source,
        transliteration: {
          language: "en-Latn",
          text: "keep romanization",
          segments: [],
          origin: "google" as const,
          sourceFingerprint: "old",
        },
        translations: {
          en: { language: "en", text: "keep translation", origin: "google" as const, sourceFingerprint: "old" },
        },
      };
      const updates = generatedLanguageUpdates(line, {
        force: true,
        transliteration: {
          language: "en-Latn",
          main: new Map([["line", { ...result.lines[0], segments: [] }]]),
          background: new Map(),
        },
        translations: [{ language: "en", main: new Map([["line", result.lines[0]]]), background: new Map() }],
      });
      expect(updates).not.toHaveProperty("transliteration");
      expect(updates.translations?.en).toBe(line.translations.en);

      fetchMock.mockImplementation(
        async () => new Response(JSON.stringify([[["retry value", source, "retry value"]], null, "en"])),
      );
      const retry = await run();
      expect(retry.lines[0].failed).toBeUndefined();
      expect(retry.lines[0].text).toBeTruthy();
      await run();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  it.each(["translate", "transliterate"] as const)(
    "distinguishes failed %s requests from successful empty results and retries failures",
    async (operation) => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const failingText = `request failure ${operation}`;
      const unchangedText = `unchanged ${operation}`;
      const fetchMock = vi.fn(async (input: string | URL | Request) => {
        const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
        const text = url.searchParams.get("q");
        if (text === failingText) return new Response(null, { status: 503 });
        return new Response(JSON.stringify([[[text, text]], null, "en"]));
      });
      vi.stubGlobal("fetch", fetchMock);
      const inputs = [
        { id: "failed", text: failingText },
        { id: "empty", text: unchangedText },
      ];
      const run = () =>
        operation === "translate"
          ? googleLanguageProvider.translate(inputs, "en", "en")
          : googleLanguageProvider.transliterate(inputs, "en");

      const result = await run();
      expect(result.lines[0]).toMatchObject({ id: "failed", text: null, failed: true });
      expect(result.lines[1]).toMatchObject({ id: "empty", text: null });
      expect(result.lines[1].failed).toBeUndefined();

      fetchMock.mockImplementation(
        async () => new Response(JSON.stringify([[["retry success", failingText, "retry success"]], null, "en"])),
      );
      const retry = await run();
      expect(retry.lines[0].text).toBeTruthy();
      expect(retry.lines[0].failed).toBeUndefined();
      expect(fetchMock).toHaveBeenCalledTimes(3);
    },
  );

  it("still rejects aborted requests", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new DOMException("Aborted", "AbortError");
    });
    await expect(
      googleLanguageProvider.transliterate([{ id: "aborted", text: "aborted request" }], "en"),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
