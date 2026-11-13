import type { LyricLine } from "@/domain/line/model";
/**
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";
import { splitSyncWord } from "@/domain/commands/sync";
import { realignSharedInstance } from "@/domain/group/shared-placement";
import type { LineLanguages } from "@/domain/language/model";
import { trackPieces } from "@/domain/language/pieces";
import { roleWords } from "@/domain/line/track";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine, createWord } from "@/test/factories";
import { generateTTML } from "@/utils/ttml";

function chorusLine(id: string, instanceIdx: number, begin: number): LyricLine {
  const sky = createWord({ text: "하늘", begin, end: begin + 1 });
  const languages: LineLanguages = {
    transliteration: {
      language: "ko-Latn",
      origin: "manual",
      sourceFingerprint: "",
      main: { text: "haneul", pieces: { [sky.id]: { text: "haneul" } } },
    },
  };
  return {
    ...createLine({ id, text: "하늘", words: [sky], groupId: "g1", instanceIdx, templateLineIdx: 0 }),
    languages,
  };
}

function romanSpans(ttml: string, key: string): string | undefined {
  const transliteration = ttml.slice(ttml.indexOf("<transliteration"));
  return transliteration
    .match(new RegExp(`<text for="${key}">(.*?)</text>`))?.[1]
    .replace(/ begin="[^"]*"| end="[^"]*"/g, "");
}

describe("readings of instances sharing timing", () => {
  it("gives the other instance the readings of a word split on one instance", () => {
    useProjectStore.getState().reset();
    useProjectStore.setState({
      lines: [chorusLine("a", 0, 1), chorusLine("b", 1, 11)],
      groups: [createGroup({ id: "g1", sharesTiming: true })],
    });
    const split = [
      createWord({ text: "하", begin: 1, end: 1.5, joinsNext: true }),
      createWord({ text: "늘", begin: 1.5, end: 2 }),
    ];
    useProjectStore
      .getState()
      .commit(splitSyncWord("a", 0, split, [{ text: "ha", joinerAfter: "" }, { text: "neul" }]));

    const [, b] = useProjectStore.getState().lines;
    const pieces = trackPieces(b, "main");
    expect(roleWords(b, "main")?.map((word) => pieces?.[word.id]?.text)).toEqual(["ha", "neul"]);
    const ttml = generateTTML({
      metadata: { title: "", artists: [], album: "", duration: 20, language: "ko" },
      agents: useProjectStore.getState().agents,
      lines: useProjectStore.getState().lines,
    });
    expect(romanSpans(ttml, "L2")).toBe(romanSpans(ttml, "L1"));
    expect(romanSpans(ttml, "L1")).toContain(">neul<");
  });
});

describe("readings when an instance takes the shared timing again", () => {
  it("regression: the realigned instance gets the reference's chosen readings", () => {
    const syllables = [
      createWord({ text: "하", begin: 1, end: 1.5, joinsNext: true }),
      createWord({ text: "늘", begin: 1.5, end: 2 }),
    ];
    const reference: LyricLine = {
      ...createLine({ id: "a", text: "하|늘", words: syllables, groupId: "g1", instanceIdx: 0, templateLineIdx: 0 }),
      languages: {
        transliteration: {
          language: "ko-Latn",
          origin: "manual",
          sourceFingerprint: "",
          main: {
            text: "haneul",
            pieces: { [syllables[0].id]: { text: "h", joinerAfter: "" }, [syllables[1].id]: { text: "aneul" } },
          },
        },
      },
    };
    const own = chorusLine("b", 1, 11);
    const groups = [createGroup({ id: "g1", sharesTiming: true })];

    const realigned = realignSharedInstance([reference, own], groups, "g1", 1);
    const update = "updates" in realigned ? realigned.updates[0] : undefined;
    const b = { ...own, ...update?.updates };
    const pieces = trackPieces(b, "main");
    expect(roleWords(b, "main")?.map((word) => pieces?.[word.id]?.text)).toEqual(["h", "aneul"]);
  });
});

describe("readings of linked lines", () => {
  it("keeps a linked line's own readings when a word of its source is split", () => {
    const linkedLine = (id: string, instanceIdx: number, begin: number): LyricLine => {
      const sky = createWord({ text: "하늘 ", begin, end: begin + 1 });
      const sea = createWord({ text: "바다", begin: begin + 1, end: begin + 2 });
      const line = createLine({
        id,
        text: "하늘 바다",
        words: [sky, sea],
        groupId: "g1",
        instanceIdx,
        templateLineIdx: 0,
      });
      return {
        ...line,
        languages: { heldReadings: { main: { [sky.id]: { text: "haneul" }, [sea.id]: { text: `bada ${id}` } } } },
      };
    };
    useProjectStore.getState().reset();
    useProjectStore.setState({
      lines: [linkedLine("a", 0, 1), linkedLine("b", 1, 11)],
      groups: [createGroup({ id: "g1" })],
    });
    const split = [
      createWord({ text: "하", begin: 1, end: 1.5, joinsNext: true }),
      createWord({ text: "늘 ", begin: 1.5, end: 2 }),
    ];
    useProjectStore
      .getState()
      .commit(splitSyncWord("a", 0, split, [{ text: "ha", joinerAfter: "" }, { text: "neul" }]));

    const [, b] = useProjectStore.getState().lines;
    const sea = roleWords(b, "main")?.at(-1);
    expect(sea && trackPieces(b, "main")?.[sea.id]).toEqual({ text: "bada b" });
  });
});
