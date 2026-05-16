/**
 * @vitest-environment node
 */
import { type LinkGroup, type LooseLine, type LyricLine, reconcileLine } from "@/stores/project";
import { findExplicitWords } from "@/utils/explicit-detection";
import { describe, expect, it } from "vitest";

function lineWithText(id: string, text: string, words?: LooseLine["words"]): LyricLine {
  return reconcileLine({
    id,
    text,
    agentId: "v1",
    ...(words ? { words } : {}),
  });
}

describe("findExplicitWords", () => {
  it("detects a basic profanity in main lyric text and returns the wordIndex", () => {
    const result = findExplicitWords([lineWithText("L1", "I fuck you")]);
    expect(result).toHaveLength(1);
    expect(result[0].lineId).toBe("L1");
    expect(result[0].field).toBe("words");
    expect(result[0].wordIndex).toBe(1);
  });

  it("returns no suggestions for clean lyrics", () => {
    const result = findExplicitWords([lineWithText("L1", "I love you so much")]);
    expect(result).toHaveLength(0);
  });

  it("skips a word that is already marked explicit", () => {
    const result = findExplicitWords([
      lineWithText("L1", "I fuck you", [
        { text: "I ", begin: 0, end: 0.3 },
        { text: "fuck ", begin: 0.3, end: 0.6, explicit: true },
        { text: "you", begin: 0.6, end: 1 },
      ]),
    ]);
    expect(result).toHaveLength(0);
  });

  it("detects a profanity in backgroundText with field='backgroundWords'", () => {
    const line: LyricLine = {
      id: "L1",
      text: "clean main",
      agentId: "v1",
      backgroundText: "oh shit",
    };
    const result = findExplicitWords([line]);
    expect(result).toHaveLength(1);
    expect(result[0].field).toBe("backgroundWords");
    expect(result[0].wordIndex).toBe(1);
  });

  it("handles leetspeak via the recommended transformers", () => {
    const result = findExplicitWords([lineWithText("L1", "I sh1t on this")]);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((s) => s.wordIndex === 1)).toBe(true);
  });

  it("produces a stable fingerprint for the same word in the same line", () => {
    const a = findExplicitWords([lineWithText("L1", "fuck off")]);
    const b = findExplicitWords([lineWithText("L1", "fuck off")]);
    expect(a[0].fingerprint).toBe(b[0].fingerprint);
  });

  it("deduplicates multiple matches that land on the same word", () => {
    const result = findExplicitWords([lineWithText("L1", "shithead and stuff")]);
    const onWord0 = result.filter((r) => r.wordIndex === 0);
    expect(onWord0.length).toBeLessThanOrEqual(1);
  });

  it("scans multiple lines independently", () => {
    const result = findExplicitWords([
      lineWithText("A", "I love you"),
      lineWithText("B", "fuck this"),
      lineWithText("C", "all clean here"),
    ]);
    expect(result.every((r) => r.lineId === "B")).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("populates lineIndex (0-indexed) on standalone suggestions", () => {
    const result = findExplicitWords([
      lineWithText("A", "clean"),
      lineWithText("B", "more clean"),
      lineWithText("C", "fuck this"),
    ]);
    expect(result[0].lineIndex).toBe(2);
  });
});

describe("findExplicitWords · linked instances", () => {
  function linkedChorusLines(): LyricLine[] {
    return [
      {
        id: "C1",
        text: "I fuck you",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        words: [
          { text: "I ", begin: 0, end: 0.3 },
          { text: "fuck ", begin: 0.3, end: 0.6 },
          { text: "you", begin: 0.6, end: 1 },
        ],
      },
      {
        id: "C2",
        text: "I fuck you",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 1,
        templateLineIdx: 0,
        words: [
          { text: "I ", begin: 30, end: 30.4 },
          { text: "fuck ", begin: 30.4, end: 30.7 },
          { text: "you", begin: 30.7, end: 31.2 },
        ],
      },
      {
        id: "C3",
        text: "I fuck you",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 2,
        templateLineIdx: 0,
        words: [
          { text: "I ", begin: 60, end: 60.4 },
          { text: "fuck ", begin: 60.4, end: 60.7 },
          { text: "you", begin: 60.7, end: 61.2 },
        ],
      },
    ];
  }

  const choruses: LinkGroup[] = [{ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 }];

  it("collapses the same explicit word across linked instances into one suggestion", () => {
    const result = findExplicitWords(linkedChorusLines(), choruses);
    expect(result).toHaveLength(1);
    expect(result[0].word).toBe("fuck");
    expect(result[0].linked).toBeDefined();
    expect(result[0].linked?.instanceCount).toBe(3);
    expect(result[0].linked?.groupLabel).toBe("Chorus");
  });

  it("uses a stable group-scoped fingerprint independent of which instance is representative", () => {
    const result1 = findExplicitWords(linkedChorusLines(), choruses);
    const result2 = findExplicitWords(linkedChorusLines().reverse(), choruses);
    expect(result1[0].fingerprint).toBe(result2[0].fingerprint);
    expect(result1[0].fingerprint).toContain("g1");
  });

  it("treats a detached sibling as its own standalone suggestion", () => {
    const lines = linkedChorusLines();
    lines[1].detached = true;
    const result = findExplicitWords(lines, choruses);
    expect(result).toHaveLength(2);
    const linked = result.find((r) => r.linked);
    const standalone = result.find((r) => !r.linked);
    expect(linked?.linked?.instanceCount).toBe(2);
    expect(standalone?.lineId).toBe("C2");
  });

  it("emits no linked metadata for a single-instance group", () => {
    const result = findExplicitWords([linkedChorusLines()[0]], choruses);
    expect(result).toHaveLength(1);
    expect(result[0].linked).toBeUndefined();
  });

  it("toggling via the representative lineId is enough; propagation handles siblings", () => {
    const result = findExplicitWords(linkedChorusLines(), choruses);
    expect(result[0].lineId).toBe("C1");
    expect(result[0].wordIndex).toBe(1);
    expect(result[0].field).toBe("words");
  });
});
