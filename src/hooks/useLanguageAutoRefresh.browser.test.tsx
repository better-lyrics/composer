import { fieldsOfLine } from "@/domain/line/line-from-fields";
import { fieldUpdates } from "@/test/field-updates";
import { roleWords } from "@/domain/line/track";
import { lineText } from "@/domain/line/text";
import { useLanguageAutoRefresh } from "@/hooks/useLanguageAutoRefresh";
import { useProjectStore } from "@/stores/project";
import { lineById, romanizedWords, timedLine } from "@/test/generated-language-lines";
import { stubGoogleLanguageFetch } from "@/test/google-language-fetch";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "vitest-browser-react";
import { pasteLines } from "@/domain/commands/instance-rows";
import { legacyLanguages, legacyLine } from "@/test/legacy-languages";

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

    const pasted = legacyLine({
      ...fieldsOfLine(lineById("a")),
      text: "Где ты сейчас",
      words: [
        { id: "w1", text: "Где", sep: " ", begin: 1, end: 2, transliteration: "Gde", joinsNext: false },
        { id: "w2", text: "ты", sep: " ", begin: 2, end: 3, transliteration: "ty", joinsNext: false },
        { id: "w3", text: "сейчас", sep: "", begin: 3, end: 4, joinsNext: false },
      ],
      ...legacyLanguages(lineById("a").languages),
    });
    useProjectStore.getState().commit(
      pasteLines(
        fieldUpdates([
          {
            id: "a",
            updates: { text: lineText(pasted), words: roleWords(pasted, "main"), languages: pasted.languages },
          },
        ]),
      ),
    );

    await vi.advanceTimersByTimeAsync(1000);
    await expect.poll(() => romanizedWords("a"), REFRESH_WAIT).toEqual(["Gde", "ty", "seychas"]);
    expect(lineById("a").languages?.translations?.en.main.text).toBe("Where are you now");
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
      expect(lineById("a").languages?.transliteration?.main.text).toBe("Shumnaya  ulitsa");
    });
  });
});
