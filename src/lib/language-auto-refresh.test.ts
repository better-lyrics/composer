import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import {
  createRefresher,
  disposeRefreshers,
  gate,
  lineById,
  romanizedWords,
  timedLine,
} from "@/test/generated-language-lines";
import { stubGoogleLanguageFetch } from "@/test/google-language-fetch";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// -- Setup --------------------------------------------------------------------

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  disposeRefreshers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// -- Tests --------------------------------------------------------------------

describe("createLanguageAutoRefresh", () => {
  it("regenerates a generated transliteration and translation after the lyrics change", async () => {
    stubGoogleLanguageFetch({
      detectedLanguage: "ru",
      romanizations: { "Здравствуй мой друг": "Zdravstvuy moy drug" },
      translations: { "Здравствуй мой друг": "Hello my friend" },
    });
    useProjectStore.setState({
      lines: [timedLine("a", ["Здравствуй", "мой", "друг"], ["Privet", "moy", "drug"], "Привет мой друг")],
    });

    await createRefresher().refreshNow();

    const line = lineById("a");
    expect(line.transliteration?.text).toBe("Zdravstvuy  moy  drug");
    expect(line.transliteration?.sourceFingerprint).toBe(languageSourceFingerprint(line.text));
    expect(line.translations?.en.text).toBe("Hello my friend");
    expect(romanizedWords("a")).toEqual(["Zdravstvuy", "moy", "drug"]);
  });

  it("requests only the lines whose generated tracks are out of date", async () => {
    const requests = stubGoogleLanguageFetch({
      detectedLanguage: "ru",
      romanizations: { "Где же ты": "Gde zhe ty" },
      translations: { "Где же ты": "Where are you" },
    });
    const fresh = timedLine("fresh", ["Спокойной", "ночи"], ["Spokoynoy", "nochi"]);
    useProjectStore.setState({ lines: [fresh, timedLine("stale", ["Где", "же", "ты"], ["Gde", "ty"], "Где ты")] });

    await createRefresher().refreshNow();

    expect(requests.map((request) => request.text)).toEqual(["Где же ты", "Где же ты"]);
    expect(lineById("fresh")).toBe(fresh);
    expect(romanizedWords("stale")).toEqual(["Gde", "zhe", "ty"]);
  });

  describe("edge cases", () => {
    it("sends nothing when every generated track matches its line", async () => {
      const requests = stubGoogleLanguageFetch({ detectedLanguage: "ru", romanizations: {}, translations: {} });
      const line = timedLine("a", ["Белый", "снег"], ["Belyy", "sneg"]);
      useProjectStore.setState({ lines: [line] });

      await createRefresher().refreshNow();

      expect(requests).toEqual([]);
      expect(lineById("a")).toBe(line);
    });

    it("never overwrites a transliteration the user wrote", async () => {
      const requests = stubGoogleLanguageFetch({ detectedLanguage: "ru", romanizations: {}, translations: {} });
      const stale = timedLine("a", ["Тёмная", "ночь"], ["Svetlaya", "noch"], "Светлая ночь");
      const line: LyricLine = {
        ...stale,
        transliteration: stale.transliteration && { ...stale.transliteration, origin: "manual" },
        translations: {},
      };
      useProjectStore.setState({ lines: [line] });

      await createRefresher().refreshNow();

      expect(requests).toEqual([]);
      expect(lineById("a")).toBe(line);
    });

    it("leaves the tracks alone when Google fails", async () => {
      stubGoogleLanguageFetch({ detectedLanguage: "ru", romanizations: {}, translations: {} });
      const line = timedLine("a", ["Холодный", "ветер"], ["Tyoplyy", "veter"], "Тёплый ветер");
      useProjectStore.setState({ lines: [line] });

      await createRefresher().refreshNow();

      expect(lineById("a")).toBe(line);
    });

    it("drops a result when the line text changed during the request", async () => {
      const answer = gate();
      const requests = stubGoogleLanguageFetch(
        {
          detectedLanguage: "ru",
          romanizations: { "Летний дождь": "Letniy dozhd" },
          translations: { "Летний дождь": "Summer rain" },
        },
        answer.opened,
      );
      useProjectStore.setState({ lines: [timedLine("a", ["Летний", "дождь"], ["Zimniy", "dozhd"], "Зимний дождь")] });

      const refreshing = createRefresher().refreshNow();
      await vi.waitFor(() => expect(requests.length).toBeGreaterThan(0));
      useProjectStore.getState().updateLine("a", { text: "Летний ливень" }, { deriveText: false });
      answer.open();
      await refreshing;

      expect(lineById("a").transliteration?.text).toBe("Zimniy  dozhd");
    });

    it("drops a result when another project opened during the request", async () => {
      const answer = gate();
      const requests = stubGoogleLanguageFetch(
        {
          detectedLanguage: "ru",
          romanizations: { "Новый день": "Novyy den" },
          translations: { "Новый день": "New day" },
        },
        answer.opened,
      );
      useProjectStore.setState({ lines: [timedLine("a", ["Новый", "день"], ["Staryy", "den"], "Старый день")] });

      const refreshing = createRefresher().refreshNow();
      await vi.waitFor(() => expect(requests.length).toBeGreaterThan(0));
      useProjectStore.getState().startProjectSession();
      answer.open();
      await refreshing;

      expect(lineById("a").transliteration?.text).toBe("Staryy  den");
    });

    it("writes nothing after dispose", async () => {
      const answer = gate();
      const requests = stubGoogleLanguageFetch(
        {
          detectedLanguage: "ru",
          romanizations: { "Морской берег": "Morskoy bereg" },
          translations: { "Морской берег": "Sea shore" },
        },
        answer.opened,
      );
      useProjectStore.setState({ lines: [timedLine("a", ["Морской", "берег"], ["Rechnoy", "bereg"], "Речной берег")] });
      const refresher = createRefresher();

      const refreshing = refresher.refreshNow();
      await vi.waitFor(() => expect(requests.length).toBeGreaterThan(0));
      refresher.dispose();
      answer.open();
      await refreshing;

      expect(lineById("a").transliteration?.text).toBe("Rechnoy  bereg");
    });
  });

  describe("scheduling", () => {
    it("waits for the lyrics to settle before it asks Google", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const requests = stubGoogleLanguageFetch({
        detectedLanguage: "ru",
        romanizations: { "Ясное небо": "Yasnoye nebo" },
        translations: { "Ясное небо": "Clear sky" },
      });
      useProjectStore.setState({ lines: [timedLine("a", ["Ясное", "небо"], ["Seroye", "nebo"], "Серое небо")] });
      const refresher = createRefresher();

      refresher.schedule();
      await vi.advanceTimersByTimeAsync(600);
      refresher.schedule();
      await vi.advanceTimersByTimeAsync(999);
      expect(requests).toEqual([]);

      await vi.advanceTimersByTimeAsync(1);
      await vi.waitFor(() => expect(lineById("a").transliteration?.text).toBe("Yasnoye  nebo"));
    });
  });

  describe("regressions", () => {
    it("regression: settles when Google returns the line unchanged instead of a translation", async () => {
      stubGoogleLanguageFetch({
        detectedLanguage: "en",
        romanizations: {},
        translations: { "Okay baby": "Okay baby" },
      });
      const line = timedLine("a", ["Okay", "baby"], ["Okey", "detka"], "Окей детка");
      useProjectStore.setState({ lines: [{ ...line, transliteration: undefined }] });
      const refresher = createRefresher();

      await refresher.refreshNow();
      const marked = lineById("a");
      await refresher.refreshNow();

      expect(marked.translations?.en).toMatchObject({ text: "Old translation", stale: true });
      expect(lineById("a")).toBe(marked);
    });

    it("regression: never brings back a track the user removed from a line", async () => {
      stubGoogleLanguageFetch({
        detectedLanguage: "ru",
        romanizations: { "Снова дома": "Snova doma" },
        translations: { "Снова дома": "Home again", "Опять одна": "Alone again" },
      });
      const removedTranslation = timedLine("b", ["Снова", "дома"], ["Opyat", "doma"], "Опять дома");
      const removedTransliteration = timedLine("c", ["Опять", "одна"], ["Opyat", "odin"], "Опять один");
      useProjectStore.setState({
        lines: [
          { ...removedTranslation, translations: {} },
          { ...removedTransliteration, transliteration: undefined },
        ],
      });

      await createRefresher().refreshNow();

      expect(lineById("b").transliteration?.text).toBe("Snova  doma");
      expect(lineById("b").translations?.en).toBeUndefined();
      expect(lineById("c").translations?.en.text).toBe("Alone again");
      expect(lineById("c").transliteration).toBeUndefined();
    });

    it("regression: #283 a lyrics edit outside Languages refreshes the word transliteration", async () => {
      stubGoogleLanguageFetch({
        detectedLanguage: "ru",
        romanizations: { "Здравствуй, мир": "Zdravstvuy, mir" },
        translations: { "Здравствуй, мир": "Hello, world" },
      });
      useProjectStore.setState({ lines: [timedLine("a", ["Привет,", "мир"], ["Privet,", "mir"])] });
      useProjectStore.getState().updateLine("a", {
        text: "Здравствуй, мир",
        words: [
          { text: "Здравствуй, ", begin: 1, end: 2, transliteration: "Privet," },
          { text: "мир", begin: 2, end: 3, transliteration: "mir" },
        ],
      });

      await createRefresher().refreshNow();

      expect(romanizedWords("a")).toEqual(["Zdravstvuy,", "mir"]);
    });
  });
});
