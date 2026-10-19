import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { LyricLine } from "@/domain/line/model";
import { createLanguageAutoRefresh } from "@/lib/language-auto-refresh";
import { useProjectStore } from "@/stores/project";
import { stubGoogleLanguageFetch } from "@/test/google-language-fetch";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// -- Fixtures -----------------------------------------------------------------

// The provider caches answers by text for the session, so every test uses its own lyrics.
function timedLine(id: string, words: string[], romanized: string[], romanizedFrom = words.join(" ")): LyricLine {
  const sourceFingerprint = languageSourceFingerprint(romanizedFrom);
  return {
    id,
    agentId: "v1",
    text: words.join(" "),
    words: words.map((text, index) => ({
      text: index < words.length - 1 ? `${text} ` : text,
      begin: index + 1,
      end: index + 2,
      transliteration: romanized[index],
    })),
    transliteration: {
      language: "ru-Latn",
      text: romanized.join("  "),
      segments: [],
      origin: "google",
      sourceFingerprint,
      alignmentStatus: "confirmed",
    },
    translations: {
      en: { language: "en", text: "Old translation", origin: "google", sourceFingerprint },
    },
  };
}

function lineById(id: string): LyricLine {
  const line = useProjectStore.getState().lines.find((candidate) => candidate.id === id);
  if (!line) throw new Error(`Missing line ${id}`);
  return line;
}

function romanizedWords(id: string): Array<string | undefined> {
  return lineById(id).words?.map((word) => word.transliteration) ?? [];
}

function gate() {
  let open = () => {};
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
}

// -- Setup --------------------------------------------------------------------

const refreshers: Array<ReturnType<typeof createLanguageAutoRefresh>> = [];

function createRefresher() {
  const refresher = createLanguageAutoRefresh({ delayMs: 1000 });
  refreshers.push(refresher);
  return refresher;
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  for (const refresher of refreshers.splice(0)) refresher.dispose();
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

  describe("history", () => {
    it("joins the lyrics edit it follows, so one undo restores both", async () => {
      stubGoogleLanguageFetch({
        detectedLanguage: "ru",
        romanizations: { "Добрый вечер": "Dobryy vecher" },
        translations: { "Добрый вечер": "Good evening" },
      });
      useProjectStore.getState().setLinesWithHistory([timedLine("a", ["Доброе", "утро"], ["Dobroye", "utro"])]);
      useProjectStore.getState().updateLineWithHistory("a", {
        text: "Добрый вечер",
        words: [
          { text: "Добрый ", begin: 1, end: 2, transliteration: "Dobroye" },
          { text: "вечер", begin: 2, end: 3, transliteration: "utro" },
        ],
      });

      await createRefresher().refreshNow();
      expect(lineById("a").transliteration?.text).toBe("Dobryy  vecher");

      useProjectStore.getState().undo();
      expect(lineById("a").text).toBe("Доброе утро");
      expect(lineById("a").transliteration?.text).toBe("Dobroye  utro");

      useProjectStore.getState().redo();
      expect(lineById("a").text).toBe("Добрый вечер");
      expect(lineById("a").transliteration?.text).toBe("Dobryy  vecher");
    });
  });

  describe("pending edits", () => {
    it("joins an edit typed without history, so one undo restores both", async () => {
      stubGoogleLanguageFetch({
        detectedLanguage: "ru",
        romanizations: { "Тихая река": "Tikhaya reka" },
        translations: { "Тихая река": "Quiet river" },
      });
      useProjectStore.getState().setLinesWithHistory([timedLine("a", ["Быстрая", "река"], ["Bystraya", "reka"])]);
      const typed = timedLine("a", ["Тихая", "река"], ["Bystraya", "reka"], "Быстрая река");
      useProjectStore.getState().setLines([typed]);

      await createRefresher().refreshNow();
      expect(lineById("a").transliteration?.text).toBe("Tikhaya  reka");
      expect(useProjectStore.getState().isDirtySinceHistory).toBe(true);

      useProjectStore.getState().undo();
      expect(lineById("a").text).toBe("Быстрая река");
      expect(lineById("a").transliteration?.text).toBe("Bystraya  reka");
    });
  });

  describe("regressions", () => {
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
