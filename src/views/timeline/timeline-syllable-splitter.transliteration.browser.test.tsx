import type { TransliterationTrack } from "@/domain/language/model";
import { getEffectiveLines } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { render } from "@/test/render";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { TimelineSyllableSplitter } from "@/views/timeline/timeline-syllable-splitter";
import { beforeEach, describe, expect, it } from "vitest";

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
      { text: "Uh ", begin: 0, end: 0.5 },
      { text: "일단은 ", begin: 0.5, end: 1.5 },
      { text: "나", begin: 1.5, end: 2 },
    ],
    backgroundText: "그래 yeah",
    backgroundWords: [
      { text: "그래 ", begin: 2, end: 2.5 },
      { text: "yeah", begin: 2.5, end: 3 },
    ],
    transliteration: track,
  };
}

async function openSplitter(
  type: "word" | "bg",
  wordIndex: number,
  event: "timeline:split-syllable" | "timeline:split-word",
) {
  useTimelineStore.setState({ selectedWords: [{ lineId: "line-ko", lineIndex: 0, wordIndex, type }] });
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
      expect(savedLine().words?.map((word) => word.transliteration)).toEqual(["Uh", "il", "dan eun", "na"]);
      expect(savedLine().transliteration?.text).toBe("Uh  ildan eun  na");
      expect(getEffectiveLines([savedLine()])[0].words?.map((word) => word.transliteration)).toEqual([
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

      await expect.poll(() => savedLine().backgroundWords?.length).toBe(3);
      expect(savedLine().backgroundWords?.map((word) => word.transliteration)).toEqual(["ge", "urae", "yeah"]);
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
      const stored = savedLine().words ?? [];
      expect(stored.map((word) => word.text)).toEqual(["Uh ", "일단 ", "은 ", "나"]);
      expect(stored.map((word) => word.transliteration)).toEqual(["Uh", "ild", "an eun", "na"]);
      expect(savedLine().transliteration?.text).toBe("Uh  ildan eun  na");
      expect(getEffectiveLines([savedLine()])[0].words?.map((word) => word.transliteration)).toEqual([
        "Uh",
        "ild",
        "an eun",
        "na",
      ]);
    });
  });
});
