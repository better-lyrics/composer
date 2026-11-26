/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it } from "vitest";
import { addInstance } from "@/domain/commands/instance-edits";
import { withAlignedTransliteration } from "@/domain/language/align";
import { type LyricLine, reconcileLine } from "@/domain/line/model";
import { withDerivedText } from "@/domain/line/reconstruct-text";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";
import { newWordId } from "@/domain/word/id";
import { useProjectStore } from "@/stores/project";
import { type LegacyWord, legacyLanguages, legacyLine, legacyWords } from "@/test/legacy-languages";
import { getSplitCharacter } from "@/utils/split-character";
import { conformLinesToInstance } from "@/views/timeline/conform-lines-to-instance";
import { fillEmptyLinesWithInstance } from "@/views/timeline/fill-empty-lines-with-instance";
import { instanceToTemplate } from "@/views/timeline/group-ops";

function mappedWords(fragments: string[], start: number): LegacyWord[] {
  const joiners = ["", "-", "", "  "];
  return fragments.map((transliteration, index) => ({
    id: newWordId(),
    text: ["あ", "い", "う", "え", "お"][index],
    sep: index === 3 ? " " : "",
    joinsNext: index !== 3 && index < fragments.length - 1,
    begin: start + index,
    end: start + index + 0.75,
    explicit: true,
    transliteration,
    ...(index < joiners.length ? { transliterationJoinerAfter: joiners[index] } : {}),
  }));
}

function sourceLine(): LyricLine {
  return withDerivedText(
    legacyLine({
      id: "source",
      agentId: "v1",
      text: "",
      groupId: "g1",
      instanceIdx: 0,
      templateLineIdx: 0,
      words: mappedWords(["a", "bc", "", "d", "e"], 10),
      backgroundWords: mappedWords(["w", "x", "yz", "", "q"], 11),
      backgroundTextSource: "manual",
      transliteration: {
        text: "abc-d  e",
        backgroundText: "wx-yz  q",
        language: "ja-Latn",
        origin: "manual",
        sourceFingerprint: "source-fingerprint",
        segments: [{ original: "あ", transliteration: "abc" }],
        backgroundSegments: [{ original: "あ", transliteration: "wx" }],
        alignmentStatus: "confirmed",
        backgroundAlignmentStatus: "confirmed",
      },
      translations: {
        en: {
          language: "en",
          text: "Main translation",
          backgroundText: "Background translation",
          origin: "manual",
          sourceFingerprint: "source-fingerprint",
        },
      },
    }),
    getSplitCharacter(),
  );
}

function expectExactCopy(copy: LyricLine, source: LyricLine, delta: number) {
  for (const [field, side] of [
    ["words", "main"],
    ["backgroundWords", "bg"],
  ] as const) {
    expect(legacyWords(copy[field], copy.languages, side)).toEqual(
      legacyWords(source[field], source.languages, side)?.map((word) => ({
        ...word,
        begin: word.begin + delta,
        end: word.end + delta,
      })),
    );
    expect(copy[field]).not.toBe(source[field]);
    // Rendering/export must reuse the chosen boundaries, not infer new ones.
    const pieces = copy.languages?.transliteration?.[side]?.pieces;
    expect(pieces).toBeDefined();
    expect(withAlignedTransliteration(copy).languages?.transliteration?.[side]?.pieces).toBe(pieces);
  }
  const copied = copy.languages?.transliteration;
  const original = source.languages?.transliteration;
  expect(legacyLanguages(copy.languages).transliteration).toEqual(legacyLanguages(source.languages).transliteration);
  expect(copied).not.toBe(original);
  expect(copied?.main.segments).not.toBe(original?.main.segments);
  expect(copied?.bg?.segments).not.toBe(original?.bg?.segments);
  expect(copy.languages?.translations).toEqual(source.languages?.translations);
  expect(copy.languages?.translations?.en).not.toBe(source.languages?.translations?.en);
}

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
});

describe("linked group alternate-language mappings", () => {
  it("duplicates exact main/background fragments and separators through the real template/store path", () => {
    const source = sourceLine();
    useProjectStore.setState({ lines: [source] });
    const template = instanceToTemplate([source], "g1", 0);
    expect(template[0].languages?.transliteration).not.toBe(source.languages?.transliteration);
    expect(template[0].languages?.translations?.en).not.toBe(source.languages?.translations?.en);

    useProjectStore.getState().commit(addInstance("g1", template, 30));
    const copy = useProjectStore.getState().lines[1];
    expect(copy.instanceIdx).toBe(1);
    expectExactCopy(copy, source, 20);
    expect(copy.languages?.transliteration).not.toBe(template[0].languages?.transliteration);

    expect(() => {
      const segment = copy.languages?.transliteration?.main.segments?.[0];
      if (segment) segment.transliteration = "edited";
    }).toThrow(TypeError);
    expect(source.languages?.transliteration?.main.segments?.[0].transliteration).toBe("abc");
    expect(template[0].languages?.transliteration?.main.segments?.[0].transliteration).toBe("abc");
  });

  it.each(["fill", "conform"] as const)(
    "preserves mappings and clones canonical tracks when applying via %s",
    (operation) => {
      const source = sourceLine();
      const { transliteration, translations } = legacyLanguages(source.languages);
      const target: LyricLine = legacyLine({
        id: "target",
        agentId: "v2",
        text: "old content",
        transliteration: transliteration && { ...transliteration, text: "old romanization" },
        translations: translations && { en: { ...translations.en, text: "old translation" } },
      });
      const input = { lines: [source, target], groupId: "g1", template: instanceToTemplate([source], "g1", 0) };
      const result =
        operation === "fill"
          ? fillEmptyLinesWithInstance({ ...input, startIndex: 1, instanceStart: 30 })
          : conformLinesToInstance({ ...input, selectedLineIds: new Set(["target"]), playheadTime: 30 });
      expect(result.ok).toBe(true);
      expectExactCopy(result.updatedLines![1], source, 20);
      expect(result.updatedLines![0]).toBe(source);
    },
  );

  it("clears destination tracks when the applied template has no alternates", () => {
    const { languages: _languages, ...original } = sourceLine();
    const source = reconcileLine(original);
    const target = { ...sourceLine(), id: "target", groupId: undefined };
    const result = conformLinesToInstance({
      lines: [source, target],
      groupId: "g1",
      template: instanceToTemplate([source], "g1", 0),
      selectedLineIds: new Set(["target"]),
      playheadTime: 30,
    });
    expect(result.ok).toBe(true);
    expect(result.updatedLines![1].languages?.transliteration).toBeUndefined();
    expect(result.updatedLines![1].languages?.translations).toBeUndefined();
    expect(result.updatedLines![1].words).toBeDefined();
    expect(result.updatedLines![1].backgroundWords).toBeDefined();
    const applied = result.updatedLines![1];
    expect(
      legacyWords(timedSyllables(mainTrack(applied)), applied.languages)?.every(
        (word) => word.transliteration === undefined,
      ),
    ).toBe(true);
    expect(
      legacyWords(timedSyllables(backgroundTrack(applied)), applied.languages, "bg")?.every(
        (word) => word.transliteration === undefined,
      ),
    ).toBe(true);
  });
});
