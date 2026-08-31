import { googleLanguageProvider, normalizeGoogleTransliteration } from "@/services/google-language-provider";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

describe("Google transliteration normalization", () => {
  it("canonicalizes Google syllable separators while preserving word boundaries", () => {
    expect(normalizeGoogleTransliteration("oh-la—mundo")).toBe("oh la mundo");
  });

  it("collapses repeated separators and whitespace", () => {
    expect(normalizeGoogleTransliteration("  ni--hao   ma ")).toBe("ni hao  ma");
  });
});

describe("Google transliteration script fallback", () => {
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
