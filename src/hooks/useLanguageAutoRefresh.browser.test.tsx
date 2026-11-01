import { useLanguageAutoRefresh } from "@/hooks/useLanguageAutoRefresh";
import { useProjectStore } from "@/stores/project";
import { lineById, romanizedWords, timedLine } from "@/test/generated-language-lines";
import { stubGoogleLanguageFetch } from "@/test/google-language-fetch";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "vitest-browser-react";

// -- Setup --------------------------------------------------------------------

const REFRESH_WAIT = { timeout: 4000 };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// -- Tests --------------------------------------------------------------------

describe("useLanguageAutoRefresh", () => {
  it("refreshes the transliteration after a lyrics edit without opening Languages", async () => {
    // The edit must land after the mount's own refresh, or that refresh alone would pass this test.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const requests = stubGoogleLanguageFetch({
      detectedLanguage: "ru",
      romanizations: { "Где ты сейчас": "Gde ty seychas" },
      translations: { "Где ты сейчас": "Where are you now" },
    });
    useProjectStore.setState({ lines: [timedLine("a", ["Где", "ты"], ["Gde", "ty"])] });
    await renderHook(() => useLanguageAutoRefresh());
    await vi.advanceTimersByTimeAsync(5000);
    expect(requests).toEqual([]);

    useProjectStore.getState().updateLineWithHistory("a", {
      text: "Где ты сейчас",
      words: [
        { text: "Где ", begin: 1, end: 2, transliteration: "Gde" },
        { text: "ты ", begin: 2, end: 3, transliteration: "ty" },
        { text: "сейчас", begin: 3, end: 4 },
      ],
    });

    await vi.advanceTimersByTimeAsync(1000);
    await expect.poll(() => romanizedWords("a"), REFRESH_WAIT).toEqual(["Gde", "ty", "seychas"]);
    expect(lineById("a").translations?.en.text).toBe("Where are you now");
  });

  it("refreshes tracks that were already out of date when the project opened", async () => {
    stubGoogleLanguageFetch({
      detectedLanguage: "ru",
      romanizations: { "Звёзды светят": "Zvyozdy svetyat" },
      translations: { "Звёзды светят": "Stars shine" },
    });
    useProjectStore.setState({
      lines: [timedLine("a", ["Звёзды", "светят"], ["Luna", "svetit"], "Луна светит")],
    });

    await renderHook(() => useLanguageAutoRefresh());

    await expect.poll(() => romanizedWords("a"), REFRESH_WAIT).toEqual(["Zvyozdy", "svetyat"]);
  });

  describe("lifecycle", () => {
    it("stops refreshing after unmount", async () => {
      // Proving that nothing fires needs the clock past the debounce, not a fixed wait.
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const requests = stubGoogleLanguageFetch({
        detectedLanguage: "ru",
        romanizations: { "Пустая улица": "Pustaya ulitsa" },
        translations: { "Пустая улица": "Empty street" },
      });
      useProjectStore.setState({ lines: [timedLine("a", ["Шумная", "улица"], ["Shumnaya", "ulitsa"])] });
      const { unmount } = await renderHook(() => useLanguageAutoRefresh());
      await unmount();

      useProjectStore.setState({
        lines: [timedLine("a", ["Пустая", "улица"], ["Shumnaya", "ulitsa"], "Шумная улица")],
      });
      await vi.advanceTimersByTimeAsync(5000);

      expect(requests).toEqual([]);
      expect(lineById("a").transliteration?.text).toBe("Shumnaya  ulitsa");
    });
  });
});
