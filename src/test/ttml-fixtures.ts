import type { LyricLine } from "@/domain/line/model";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { legacyLine } from "@/test/legacy-languages";
import { generateTTML } from "@/utils/ttml";

// -- Fixtures -----------------------------------------------------------------

function threeSyncedLines(): LyricLine[] {
  return [
    createLine({
      id: "line-a",
      text: "first line here",
      words: [
        { text: "first", sep: " ", begin: 2, end: 3 },
        { text: "line", sep: " ", begin: 3, end: 4 },
        { text: "here", begin: 4, end: 6 },
      ],
    }),
    createLine({
      id: "line-b",
      text: "second line now",
      words: [
        { text: "second", sep: " ", begin: 12, end: 14 },
        { text: "line", sep: " ", begin: 14, end: 16 },
        { text: "now", begin: 16, end: 18 },
      ],
    }),
    createLine({
      id: "line-c",
      text: "third line ends",
      words: [
        { text: "third", sep: " ", begin: 24, end: 26 },
        { text: "line", sep: " ", begin: 26, end: 28 },
        { text: "ends", begin: 28, end: 30 },
      ],
    }),
  ];
}

/**
 * Three word-synced lyric lines with wide, non-overlapping time windows,
 * rendered to a real TTML string via the production generator. Used by the
 * preview renderer tests to drive highlight and line-click behaviour.
 *
 * Windows: "first line here" 2-6s, "second line now" 12-18s, "third line ends"
 * 24-30s.
 *
 * `durationSeconds` becomes the document's `dur`, the only channel a song
 * duration reaches a lyrics parser through.
 */
function buildSyncedTtml(durationSeconds?: number): string {
  const { metadata, agents } = useProjectStore.getState();
  return generateTTML({ metadata, agents, lines: threeSyncedLines(), groups: [], duration: durationSeconds });
}

/** One word-synced line 2-6s carrying a background vocal over its second half. */
function buildBackgroundVocalTtml(): string {
  const lines = [
    createLine({
      id: "line-bg",
      text: "first line here",
      words: [
        { text: "first", sep: " ", begin: 2, end: 3 },
        { text: "line", sep: " ", begin: 3, end: 4 },
        { text: "here", begin: 4, end: 6 },
      ],
      backgroundText: "ooh ahh",
      backgroundWords: [
        { text: "ooh", sep: " ", begin: 4, end: 5 },
        { text: "ahh", begin: 5, end: 6 },
      ],
    }),
  ];
  const { metadata, agents } = useProjectStore.getState();
  return generateTTML({ metadata, agents, lines, groups: [] });
}

/** One synced Korean line with a timed transliteration and an English translation. */
function buildAlternateLanguageTtml(): string {
  const lines = [
    createLine({
      id: "line-language",
      text: "안녕 세상",
      words: [
        { text: "안녕", sep: " ", begin: 2, end: 4 },
        { text: "세상", begin: 4, end: 6 },
      ],
    }),
  ];
  lines[0] = legacyLine({
    ...lines[0],
    words: lines[0].words?.map((word, index) => ({
      ...word,
      transliteration: index === 0 ? "annyeong" : "sesang",
    })),
    transliteration: {
      language: "ko-Latn",
      text: "annyeong sesang",
      segments: [{ original: "안녕 세상", transliteration: "annyeong sesang" }],
      origin: "manual",
      sourceFingerprint: "preview-fixture",
    },
    translations: {
      en: {
        language: "en",
        text: "Hello world",
        origin: "manual",
        sourceFingerprint: "preview-fixture",
      },
    },
  });

  const { metadata, agents } = useProjectStore.getState();
  return generateTTML({ metadata, agents, lines, groups: [] });
}

/** One synced Korean line whose alternate-language background vocal falls in a foreground pause. */
function buildAlternateBackgroundLanguageTtml(): string {
  const lines = [
    createLine({
      id: "line-language-background",
      text: "안녕 세상",
      words: [
        { text: "안녕", sep: " ", begin: 2, end: 3 },
        { text: "세상", begin: 4, end: 6 },
      ],
      backgroundText: "오",
      backgroundWords: [{ text: "오", begin: 3.2, end: 3.8 }],
    }),
  ];
  const [annyeong, sesang] = timedSyllables(mainTrack(lines[0]));
  const [oh] = timedSyllables(backgroundTrack(lines[0]));
  lines[0] = legacyLine({
    ...lines[0],
    words: [
      { ...annyeong, transliteration: "annyeong" },
      { ...sesang, transliteration: "sesang" },
    ],
    backgroundWords: [{ ...oh, transliteration: "oh" }],
    transliteration: {
      language: "ko-Latn",
      text: "annyeong sesang",
      backgroundText: "oh",
      segments: [{ original: "안녕 세상", transliteration: "annyeong sesang" }],
      backgroundSegments: [{ original: "오", transliteration: "oh" }],
      origin: "manual",
      sourceFingerprint: "preview-background-fixture",
    },
    translations: {
      en: {
        language: "en",
        text: "Hello world",
        backgroundText: "Oh",
        origin: "manual",
        sourceFingerprint: "preview-background-fixture",
      },
    },
  });

  const { metadata, agents } = useProjectStore.getState();
  return generateTTML({ metadata, agents, lines, groups: [] });
}

/** One synced line whose alternate tracks are identical to the main text. */
function buildMatchingAlternateLanguageTtml(): string {
  const lines = [
    createLine({
      id: "line-matching-language",
      text: "same line",
      words: [
        { text: "same", sep: " ", begin: 2, end: 4 },
        { text: "line", begin: 4, end: 6 },
      ],
    }),
  ];
  lines[0] = legacyLine({
    ...lines[0],
    words: timedSyllables(mainTrack(lines[0])).map((word, index) => ({
      ...word,
      transliteration: index === 0 ? "Same," : "LINE!",
    })),
    transliteration: {
      language: "en-Latn",
      text: "Same, LINE!",
      segments: [{ original: "same line", transliteration: "Same, LINE!" }],
      origin: "manual",
      sourceFingerprint: "matching-preview-fixture",
    },
    translations: {
      en: {
        language: "en",
        text: "SAME, LINE!",
        origin: "manual",
        sourceFingerprint: "matching-preview-fixture",
      },
    },
  });

  const { metadata, agents } = useProjectStore.getState();
  return generateTTML({
    metadata,
    agents,
    lines,
    groups: [],
  });
}

// -- Exports ------------------------------------------------------------------

export {
  buildAlternateBackgroundLanguageTtml,
  buildAlternateLanguageTtml,
  buildBackgroundVocalTtml,
  buildMatchingAlternateLanguageTtml,
  buildSyncedTtml,
};
