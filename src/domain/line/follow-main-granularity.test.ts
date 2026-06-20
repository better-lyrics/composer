import { bgBounds } from "@/domain/line/bounds";
import { followMainGranularity } from "@/domain/line/follow-main-granularity";
import { type LooseLine, reconcileLine } from "@/domain/line/model";
import { bgVoice, bgWords } from "@/domain/line/voices";
import { isWordSynced } from "@/domain/voice/predicates";
import { describe, expect, it } from "vitest";

// Pure unit tests for followMainGranularity: the once-only main-to-word
// transition that lets an existing background follow main into word-synced
// granularity. No store, no mocks - real reconcileLine-built lines.

function line(fields: LooseLine) {
  return reconcileLine(fields);
}

function lineSyncedMainWithLineSyncedBg(begin: number, end: number) {
  // Build a line-synced bg the way the funnel does: reconcileLine cannot carry a
  // line-synced background, so place one nested directly over a line-synced main.
  const base = line({ id: "L1", text: "Real line", agentId: "v1", begin, end });
  const half = { begin: (begin + end) / 2, end };
  return { ...base, background: { text: "ooh ahh", begin: half.begin, end: half.end, source: "manual" as const } };
}

const wordMain = [
  { text: "Real ", begin: 2, end: 5 },
  { text: "line", begin: 5, end: 10 },
];

describe("followMainGranularity · transition resolution", () => {
  it("line-synced bg distributes over its OWN bounds when main becomes word-synced", () => {
    const before = lineSyncedMainWithLineSyncedBg(2, 10);
    const ownBounds = bgBounds(before);
    if (!ownBounds) throw new Error("expected line-synced bg bounds");
    const after = line({ id: "L1", text: "Real line", agentId: "v1", words: wordMain });
    const afterWithBg = { ...after, background: before.background };

    const result = followMainGranularity(before, afterWithBg);

    const words = bgWords(result);
    expect(words).toBeDefined();
    if (!words) throw new Error("expected bg words");
    expect(words.length).toBe(2);
    expect(words[0].begin).toBe(ownBounds.begin);
    expect(words[words.length - 1].end).toBe(ownBounds.end);
  });

  it("untimed bg distributes over the new main's second half when main becomes word-synced", () => {
    const before = line({ id: "L1", text: "Real line", agentId: "v1", backgroundText: "ooh ahh" });
    const after = line({ id: "L1", text: "Real line", agentId: "v1", words: wordMain, backgroundText: "ooh ahh" });

    const result = followMainGranularity(before, after);

    const words = bgWords(result);
    expect(words).toBeDefined();
    if (!words) throw new Error("expected bg words");
    expect(words[0].begin).toBe((2 + 10) / 2);
    expect(words[words.length - 1].end).toBe(10);
  });

  it("word-synced bg is returned on the same `after` reference (no re-distribution)", () => {
    const before = line({ id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 10 });
    const after = line({
      id: "L1",
      text: "Real line",
      agentId: "v1",
      words: wordMain,
      backgroundText: "ooh ahh",
      backgroundWords: [
        { text: "ooh ", begin: 3, end: 4 },
        { text: "ahh", begin: 4, end: 5 },
      ],
      backgroundTextSource: "manual",
    });

    const result = followMainGranularity(before, after);

    expect(result).toBe(after);
    expect(bgVoice(result)).toBe(bgVoice(after));
  });
});

describe("followMainGranularity · guards", () => {
  it("returns `after` unchanged and reference-equal when main was ALREADY word-synced", () => {
    const before = line({
      id: "L1",
      text: "Real line",
      agentId: "v1",
      words: [
        { text: "Real ", begin: 0, end: 1 },
        { text: "line", begin: 1, end: 2 },
      ],
      backgroundText: "ooh ahh",
      backgroundWords: [{ text: "ooh ahh", begin: 0, end: 2 }],
      backgroundTextSource: "manual",
    });
    const after = line({ id: "L1", text: "Real line", agentId: "v1", words: wordMain, backgroundText: "ooh ahh" });

    const result = followMainGranularity(before, after);

    expect(result).toBe(after);
  });

  it("returns `after` reference-equal when after's main is NOT word-synced", () => {
    const before = line({ id: "L1", text: "Real line", agentId: "v1", backgroundText: "ooh ahh" });
    const after = line({ id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 10, backgroundText: "ooh ahh" });

    const result = followMainGranularity(before, after);

    expect(result).toBe(after);
  });

  it("returns `after` reference-equal when there is no background to follow", () => {
    const before = line({ id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 10 });
    const after = line({ id: "L1", text: "Real line", agentId: "v1", words: wordMain });

    const result = followMainGranularity(before, after);

    expect(result).toBe(after);
  });
});

describe("followMainGranularity · invariants", () => {
  it("does not mutate the input `before` line", () => {
    const before = lineSyncedMainWithLineSyncedBg(2, 10);
    const snapshot = structuredClone(before);
    const after = {
      ...line({ id: "L1", text: "Real line", agentId: "v1", words: wordMain }),
      background: before.background,
    };

    followMainGranularity(before, after);

    expect(before).toEqual(snapshot);
  });

  it("does not mutate the input `after` line", () => {
    const before = lineSyncedMainWithLineSyncedBg(2, 10);
    const after = {
      ...line({ id: "L1", text: "Real line", agentId: "v1", words: wordMain }),
      background: { ...before.background },
    };
    const snapshot = structuredClone(after);

    followMainGranularity(before, after);

    expect(after).toEqual(snapshot);
  });

  it("is idempotent: running twice equals running once", () => {
    const before = lineSyncedMainWithLineSyncedBg(2, 10);
    const after = {
      ...line({ id: "L1", text: "Real line", agentId: "v1", words: wordMain }),
      background: before.background,
    };

    const once = followMainGranularity(before, after);
    const twice = followMainGranularity(once, once);

    expect(twice).toEqual(once);
    expect(twice).toBe(once);
  });
});

describe("followMainGranularity · edge cases", () => {
  it("returns `after` unchanged when after's main has empty words (not word-synced)", () => {
    const before = line({ id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 10, backgroundText: "ooh ahh" });
    const after = { ...before, main: { text: "Real line", words: [] } };

    const result = followMainGranularity(before, after);

    expect(result).toBe(after);
    expect(isWordSynced(after.main)).toBe(false);
  });

  it("keeps a line-synced bg untimed-distributed when its own bounds are present", () => {
    const before = lineSyncedMainWithLineSyncedBg(0, 20);
    const ownBounds = bgBounds(before);
    if (!ownBounds) throw new Error("expected line-synced bg bounds");
    const after = {
      ...line({
        id: "L1",
        text: "Real line",
        agentId: "v1",
        words: [
          { text: "Real ", begin: 0, end: 10 },
          { text: "line", begin: 10, end: 20 },
        ],
      }),
      background: before.background,
    };

    const result = followMainGranularity(before, after);

    const words = bgWords(result);
    if (!words) throw new Error("expected bg words");
    expect(words[0].begin).toBe(ownBounds.begin);
    expect(words[words.length - 1].end).toBe(ownBounds.end);
  });
});
