import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pasteLyrics } from "@/domain/commands/edit-text";
import { pasteLines } from "@/domain/commands/instance-rows";
import { type LyricLine, reconcileLine } from "@/domain/line/model";
import { lineText } from "@/domain/line/text";
import { useProjectStore } from "@/stores/project";
import { createRefresher, disposeRefreshers, gate, lineById, timedLine } from "@/test/generated-language-lines";
import { stubGoogleLanguageFetch } from "@/test/google-language-fetch";

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
      useProjectStore
        .getState()
        .commit(
          pasteLyrics(useProjectStore.getState().lines, [timedLine("a", ["Доброе", "утро"], ["Dobroye", "utro"])]),
        );
      useProjectStore.getState().commit(
        pasteLines([
          {
            id: "a",
            updates: {
              text: "Добрый вечер",
              words: [
                { id: "w1", text: "Добрый", sep: " ", begin: 1, end: 2, transliteration: "Dobroye", joinsNext: false },
                { id: "w2", text: "вечер", sep: "", begin: 2, end: 3, transliteration: "utro", joinsNext: false },
              ],
            },
          },
        ]),
      );

      await createRefresher().refreshNow();
      expect(lineById("a").transliteration?.text).toBe("Dobryy  vecher");

      useProjectStore.getState().undo();
      expect(lineText(lineById("a"))).toBe("Доброе утро");
      expect(lineById("a").transliteration?.text).toBe("Dobroye  utro");

      useProjectStore.getState().redo();
      expect(lineText(lineById("a"))).toBe("Добрый вечер");
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
      useProjectStore
        .getState()
        .commit(
          pasteLyrics(useProjectStore.getState().lines, [timedLine("a", ["Быстрая", "река"], ["Bystraya", "reka"])]),
        );
      const typed = timedLine("a", ["Тихая", "река"], ["Bystraya", "reka"], "Быстрая река");
      useProjectStore.getState().restoreLyrics({ lines: [typed] });

      await createRefresher().refreshNow();
      expect(lineById("a").transliteration?.text).toBe("Tikhaya  reka");
      expect(useProjectStore.getState().isDirtySinceHistory).toBe(true);

      useProjectStore.getState().undo();
      expect(lineText(lineById("a"))).toBe("Быстрая река");
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
      useProjectStore
        .getState()
        .commit(
          pasteLyrics(useProjectStore.getState().lines, [
            timedLine("a", ["Короткая", "дорога"], ["Korotkaya", "doroga"]),
          ]),
        );
      const edited = timedLine("a", ["Длинная", "дорога", `${typed}`], ["Korotkaya", "doroga"], "Короткая дорога");
      if (typed) useProjectStore.getState().restoreLyrics({ lines: [edited] });
      else useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, [edited]));
      const historyBefore = useProjectStore.getState().history;
      const refresher = createRefresher();

      const refreshing = refresher.refreshNow();
      await vi.waitFor(() => expect(requests.length).toBeGreaterThan(0));
      const preview = [stretched(lineById("a"))];
      useProjectStore.getState().previewLines(preview);
      answer.open();
      await refreshing;

      expect(useProjectStore.getState().lines).toBe(preview);
      expect(useProjectStore.getState().history).toBe(historyBefore);

      useProjectStore.getState().previewLines([edited]);
      useProjectStore.getState().commit(pasteLines([{ id: "a", updates: { words: preview[0].words } }]));
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
        .commit(
          pasteLyrics(useProjectStore.getState().lines, [
            timedLine("a", ["Тихий", "берег"], ["Shumnyy", "bereg"], "Шумный берег"),
          ]),
        );
      const committed = useProjectStore.getState().lines;

      useProjectStore.getState().previewLines([stretched(lineById("a"))]);
      useProjectStore.getState().restorePreviewLines(committed);
      await createRefresher().refreshNow();

      expect(lineById("a").transliteration?.text).toBe("Tikhiy  bereg");
    });
  });
});
