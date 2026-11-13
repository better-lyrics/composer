import { beforeEach, describe, expect, it } from "vitest";
import type { TransliterationTrack } from "@/domain/language/model";
import { getEffectiveLines } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { render } from "@/test/render";
import { storedWordAddress } from "@/test/word-address";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { TimelineSyllableSplitter } from "@/views/timeline/timeline-syllable-splitter";

// -- Fixtures -----------------------------------------------------------------

const track: TransliterationTrack = {
  language: "ko-Latn",
  text: "Uh  ildan eun  na",
  backgroundText: "geurae  yeah",
  segments: [{ original: "Uh 일단은 나", transliteration: "Uh  ildan eun  na" }],
  backgroundSegments: [{ original: "그래 yeah", transliteration: "geurae  yeah" }],
  origin: "google",
  sourceFingerprint: "source",
};

function lineWithoutPieces(): LyricLine {
  return {
    id: "line-ko",
    agentId: "v1",
    text: "Uh 일단은 나",
    words: [
      { id: "w1", text: "Uh", sep: " ", begin: 0, end: 0.5 },
      { id: "w2", text: "일단은", sep: " ", begin: 0.5, end: 1.5 },
      { id: "w3", text: "나", sep: "", begin: 1.5, end: 2 },
    ],
    backgroundText: "그래 yeah",
    backgroundWords: [
      { id: "w4", text: "그래", sep: " ", begin: 2, end: 2.5 },
      { id: "w5", text: "yeah", sep: "", begin: 2.5, end: 3 },
    ],
    transliteration: track,
  };
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

      await expect.poll(() => savedLine().words?.length).toBe(4);
      expect(timedSyllables(mainTrack(savedLine())).map((word) => word.transliteration)).toEqual([
        "Uh",
        "il",
        "dan eun",
        "na",
      ]);
      expect(savedLine().transliteration?.text).toBe("Uh  ildan eun  na");
      expect(
        timedSyllables(mainTrack(getEffectiveLines([savedLine()])[0])).map((word) => word.transliteration),
      ).toEqual(["Uh", "il", "dan eun", "na"]);
    });

    it("regression: keeps the chosen roman split on the background track (#283)", async () => {
      const screen = await openSplitter("bg", 0, "timeline:split-syllable");

      await screen.getByRole("button", { name: "Original split point 1" }).click();
      await screen.getByRole("button", { name: "Transliteration split point 3" }).click();
      await screen.getByRole("button", { name: "Transliteration split point 2" }).click();
      await screen.getByRole("button", { name: "Split Word" }).click();

      await expect.poll(() => savedLine().backgroundWords?.length).toBe(3);
      expect(timedSyllables(backgroundTrack(savedLine())).map((word) => word.transliteration)).toEqual([
        "ge",
        "urae",
        "yeah",
      ]);
      expect(savedLine().transliteration?.backgroundText).toBe("geurae  yeah");
      expect(savedLine().transliteration?.text).toBe("Uh  ildan eun  na");
    });

    it("regression: split word mode gives each part its own transliteration (#283)", async () => {
      const screen = await openSplitter("word", 1, "timeline:split-word");

      await screen.getByRole("button", { name: "Original split point 2" }).click();
      await screen.getByRole("button", { name: "Transliteration pronunciation break 6" }).click();
      await screen.getByRole("button", { name: "Transliteration split point 3" }).click();
      await screen.getByRole("button", { name: "Split Word" }).click();

      await expect.poll(() => savedLine().words?.length).toBe(4);
      const stored = timedSyllables(mainTrack(savedLine()));
      expect(stored.map((word) => word.text + word.sep)).toEqual(["Uh ", "일단 ", "은 ", "나"]);
      expect(stored.map((word) => word.transliteration)).toEqual(["Uh", "ild", "an eun", "na"]);
      expect(savedLine().transliteration?.text).toBe("Uh  ildan eun  na");
      expect(
        timedSyllables(mainTrack(getEffectiveLines([savedLine()])[0])).map((word) => word.transliteration),
      ).toEqual(["Uh", "ild", "an eun", "na"]);
    });
  });
});
