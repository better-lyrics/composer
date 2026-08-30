import { googleLanguageProvider, normalizeGoogleTransliteration } from "@/services/google-language-provider";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

describe("Google transliteration normalization", () => {
  it("canonicalizes Google syllable separators while preserving word boundaries", () => {
    expect(normalizeGoogleTransliteration("oh-la—mundo")).toBe("oh-la-mundo");
  });

  it("collapses repeated separators and whitespace", () => {
    expect(normalizeGoogleTransliteration("  ni--hao   ma ")).toBe("ni-hao ma");
  });

  it("fits Google token boundaries to Composer source-word boundaries", () => {
    expect(normalizeGoogleTransliteration("ima wa tōzen desu", "今は 当然")).toBe("ima-wa tōzen-desu");
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
    expect(result.lines[0].text).toBe("geol-eum-eun Like a dance");
    expect(result.lines[0].segments).toEqual([
      { original: "걸음은 Like a dance", transliteration: "geol-eum-eun Like a dance" },
    ]);
  });
});
