import { beforeEach, describe, expect, it } from "vitest";
import type { V3TransliterationTrack } from "@/domain/language/v3-languages";
import { getEffectiveLines } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import { backgroundTrack, mainTrack, roleWords, timedSyllables } from "@/domain/line/track";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { type LegacyWord, legacyLine, legacyWords } from "@/test/legacy-languages";
import { render } from "@/test/render";
import { storedWordAddress } from "@/test/word-address";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { TimelineSyllableSplitter } from "@/views/timeline/timeline-syllable-splitter";

// -- Fixtures -----------------------------------------------------------------

const track: V3TransliterationTrack = {
  language: "ko-Latn",
  text: "Uh  ildan eun  na",
  backgroundText: "geurae  yeah",
  segments: [{ original: "Uh 일단은 나", transliteration: "Uh  ildan eun  na" }],
  backgroundSegments: [{ original: "그래 yeah", transliteration: "geurae  yeah" }],
  origin: "google",
  sourceFingerprint: "source",
};

function lineWithoutPieces(): LyricLine {
  return legacyLine({
    id: "line-ko",
    agentId: "v1",
    text: "Uh 일단은 나",
    words: [
      { id: "w1", text: "Uh", sep: " ", begin: 0, end: 0.5, joinsNext: false },
      { id: "w2", text: "일단은", sep: " ", begin: 0.5, end: 1.5, joinsNext: false },
      { id: "w3", text: "나", sep: "", begin: 1.5, end: 2, joinsNext: false },
    ],
    backgroundText: "그래 yeah",
    backgroundWords: [
      { id: "w4", text: "그래", sep: " ", begin: 2, end: 2.5, joinsNext: false },
      { id: "w5", text: "yeah", sep: "", begin: 2.5, end: 3, joinsNext: false },
    ],
    transliteration: track,
  });
}

function readings(line: LyricLine, side: "main" | "bg" = "main"): LegacyWord[] {
  const track = side === "main" ? mainTrack(line) : backgroundTrack(line);
  return legacyWords(timedSyllables(track), line.languages, side) ?? [];
}

async function openSplitter(
  type: "word" | "bg",
  wordIndex: number,
  event: "timeline:split-syllable" | "timeline:split-word",
) {
  useTimelineStore.setState({ selectedWords: [storedWordAddress("line-ko", wordIndex, type)] });
  const screen = await render(<TimelineSyllableSplitter />);
  window.dispatchEvent(new Event(event));
  return screen;
}

function savedLine(): LyricLine {
  return useProjectStore.getState().lines[0];
}

// -- Tests --------------------------------------------------------------------

describe("TimelineSyllableSplitter transliteration", () => {
  beforeEach(() => {
    useAudioStore.getState().reset();
    useProjectStore.setState({ lines: [lineWithoutPieces()] });
  });

  describe("regressions", () => {
    it("regression: keeps the chosen roman split when stored words lost their pieces (#283)", async () => {
      const screen = await openSplitter("word", 1, "timeline:split-syllable");

      await screen.getByRole("button", { name: "Original split point 1" }).click();
      await screen.getByRole("button", { name: "Transliteration split point 3" }).click();
      await screen.getByRole("button", { name: "Transliteration split point 2" }).click();
      await screen.getByRole("button", { name: "Split Word" }).click();

      await expect.poll(() => roleWords(savedLine(), "main")?.length).toBe(4);
      expect(readings(savedLine()).map((word) => word.transliteration)).toEqual(["Uh", "il", "dan eun", "na"]);
      expect(savedLine().languages?.transliteration?.main.text).toBe("Uh  ildan eun  na");
      expect(readings(getEffectiveLines([savedLine()])[0]).map((word) => word.transliteration)).toEqual([
        "Uh",
        "il",
        "dan eun",
        "na",
      ]);
    });

    it("regression: keeps the chosen roman split on the background track (#283)", async () => {
      const screen = await openSplitter("bg", 0, "timeline:split-syllable");

      await screen.getByRole("button", { name: "Original split point 1" }).click();
      await screen.getByRole("button", { name: "Transliteration split point 3" }).click();
      await screen.getByRole("button", { name: "Transliteration split point 2" }).click();
      await screen.getByRole("button", { name: "Split Word" }).click();

      await expect.poll(() => roleWords(savedLine(), "bg")?.length).toBe(3);
      expect(readings(savedLine(), "bg").map((word) => word.transliteration)).toEqual(["ge", "urae", "yeah"]);
      expect(savedLine().languages?.transliteration?.bg?.text).toBe("geurae  yeah");
      expect(savedLine().languages?.transliteration?.main.text).toBe("Uh  ildan eun  na");
    });

    it("regression: split word mode gives each part its own transliteration (#283)", async () => {
      const screen = await openSplitter("word", 1, "timeline:split-word");

      await screen.getByRole("button", { name: "Original split point 2" }).click();
      await screen.getByRole("button", { name: "Transliteration pronunciation break 6" }).click();
      await screen.getByRole("button", { name: "Transliteration split point 3" }).click();
      await screen.getByRole("button", { name: "Split Word" }).click();

      await expect.poll(() => roleWords(savedLine(), "main")?.length).toBe(4);
      const stored = readings(savedLine());
      expect(stored.map((word) => word.text + word.sep)).toEqual(["Uh ", "일단 ", "은 ", "나"]);
      expect(stored.map((word) => word.transliteration)).toEqual(["Uh", "ild", "an eun", "na"]);
      expect(savedLine().languages?.transliteration?.main.text).toBe("Uh  ildan eun  na");
      expect(readings(getEffectiveLines([savedLine()])[0]).map((word) => word.transliteration)).toEqual([
        "Uh",
        "ild",
        "an eun",
        "na",
      ]);
    });
  });
});
