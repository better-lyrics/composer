import { type LyricLine, reconcileLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { createRefresher, disposeRefreshers, gate, lineById, timedLine } from "@/test/generated-language-lines";
import { stubGoogleLanguageFetch } from "@/test/google-language-fetch";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// -- Setup --------------------------------------------------------------------

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  disposeRefreshers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// -- Tests --------------------------------------------------------------------

describe("createLanguageAutoRefresh history", () => {
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

  describe("drag previews", () => {
    function stretched(line: LyricLine): LyricLine {
      return reconcileLine({ ...line, words: line.words?.map((word) => ({ ...word, end: word.end + 0.5 })) });
    }

    it.each([
      ["committed", false],
      ["typed without history", true],
    ])("regression: never applies over a drag preview after an edit %s", async (_label, typed) => {
      const answer = gate();
      const requests = stubGoogleLanguageFetch(
        {
          detectedLanguage: "ru",
          romanizations: { [`Длинная дорога ${typed}`]: `Dlinnaya doroga ${typed}` },
          translations: { [`Длинная дорога ${typed}`]: "Long road" },
        },
        answer.opened,
      );
      useProjectStore.getState().setLinesWithHistory([timedLine("a", ["Короткая", "дорога"], ["Korotkaya", "doroga"])]);
      const edited = timedLine("a", ["Длинная", "дорога", `${typed}`], ["Korotkaya", "doroga"], "Короткая дорога");
      if (typed) useProjectStore.getState().setLines([edited]);
      else useProjectStore.getState().setLinesWithHistory([edited]);
      const historyBefore = useProjectStore.getState().history;
      const refresher = createRefresher();

      const refreshing = refresher.refreshNow();
      await vi.waitFor(() => expect(requests.length).toBeGreaterThan(0));
      const preview = [stretched(lineById("a"))];
      useProjectStore.getState().setTransientLines(preview);
      answer.open();
      await refreshing;

      expect(useProjectStore.getState().lines).toBe(preview);
      expect(useProjectStore.getState().history).toBe(historyBefore);

      useProjectStore.getState().setTransientLines([edited]);
      useProjectStore.getState().updateLinesWithHistory([{ id: "a", updates: { words: preview[0].words } }]);
      await refresher.refreshNow();
      expect(lineById("a").transliteration?.text).toBe(`Dlinnaya  doroga  ${typed}`);
    });

    it("regression: refreshes after a drag that was discarded", async () => {
      stubGoogleLanguageFetch({
        detectedLanguage: "ru",
        romanizations: { "Тихий берег": "Tikhiy bereg" },
        translations: { "Тихий берег": "Quiet shore" },
      });
      useProjectStore
        .getState()
        .setLinesWithHistory([timedLine("a", ["Тихий", "берег"], ["Shumnyy", "bereg"], "Шумный берег")]);
      const committed = useProjectStore.getState().lines;

      useProjectStore.getState().setTransientLines([stretched(lineById("a"))]);
      useProjectStore.getState().restoreTransientLines(committed);
      await createRefresher().refreshNow();

      expect(lineById("a").transliteration?.text).toBe("Tikhiy  bereg");
    });
  });
});
