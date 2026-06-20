import { bgBounds, mainBounds } from "@/domain/line/bounds";
import { type LyricLine, reconcileLine } from "@/domain/line/model";
import { reconcileUpdate } from "@/domain/line/reconcile-update";
import { bgSource, bgText, bgVoice, bgWords, lineText, mainWords } from "@/domain/line/voices";
import { isLineSynced, isWordSynced } from "@/domain/voice/predicates";
import type { BackgroundVoice } from "@/domain/voice/model";
import { describe, expect, it } from "vitest";

// A line-synced background cannot be expressed in the flat LooseLine shape, so a
// flat update routed through reconcileUpdate must preserve it nested rather than
// let the toFlat round-trip silently downgrade it to untimed.

function lineSyncedBgLine(): LyricLine {
  const line = reconcileLine({ id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 10 });
  const background: BackgroundVoice = { text: "ooh ahh", begin: 3, end: 7, source: "manual" };
  return { ...line, background };
}

describe("reconcileUpdate · line-synced background durability", () => {
  it("preserves a line-synced background through a non-background update (agentId)", () => {
    const prev = lineSyncedBgLine();
    const next = reconcileUpdate(prev, { agentId: "v2" });
    expect(next.agentId).toBe("v2");
    expect(bgBounds(next)).toEqual({ begin: 3, end: 7 });
    expect(bgWords(next)).toBeUndefined();
    const bg = bgVoice(next);
    expect(bg).not.toBeNull();
    if (bg) expect(isLineSynced(bg)).toBe(true);
  });

  it("preserves a line-synced background through a main-text edit, keeping main line-synced", () => {
    const prev = lineSyncedBgLine();
    const next = reconcileUpdate(prev, { text: "New words" });
    expect(lineText(next)).toBe("New words");
    expect(mainBounds(next)).toEqual({ begin: 2, end: 10 });
    expect(bgBounds(next)).toEqual({ begin: 3, end: 7 });
    expect(bgSource(next)).toBe("manual");
  });

  it("preserves a line-synced background through a main begin/end edit", () => {
    const prev = lineSyncedBgLine();
    const next = reconcileUpdate(prev, { begin: 1, end: 12 });
    expect(mainBounds(next)).toEqual({ begin: 1, end: 12 });
    expect(bgBounds(next)).toEqual({ begin: 3, end: 7 });
  });
});

describe("reconcileUpdate · transition resolves over the background's own bounds", () => {
  it("distributes a line-synced bg over its OWN bounds, not the main fallback, when main becomes word-synced", () => {
    const prev = lineSyncedBgLine();
    const next = reconcileUpdate(prev, {
      words: [
        { text: "Real ", begin: 2, end: 5 },
        { text: "line", begin: 5, end: 10 },
      ],
    });
    expect(isWordSynced(next.main)).toBe(true);
    const words = bgWords(next);
    expect(words).toBeDefined();
    if (!words) throw new Error("expected bg words");
    expect(words.length).toBe(2);
    expect(words[0].begin).toBe(3);
    expect(words[words.length - 1].end).toBe(7);
  });
});

describe("reconcileUpdate · background-touching and other-granularity updates", () => {
  it("uses the flat result (untimed) when the update explicitly sets backgroundText", () => {
    const prev = lineSyncedBgLine();
    const next = reconcileUpdate(prev, { backgroundText: "new bg" });
    expect(bgText(next)).toBe("new bg");
    expect(bgBounds(next)).toBeNull();
    expect(bgWords(next)).toBeUndefined();
  });

  it("uses the flat result when the update sets backgroundWords (no line-synced restore)", () => {
    const prev = lineSyncedBgLine();
    const backgroundWords = [
      { text: "ooh ", begin: 0, end: 1 },
      { text: "ahh", begin: 1, end: 2 },
    ];
    const next = reconcileUpdate(prev, { backgroundWords });
    expect(bgWords(next)).toEqual(backgroundWords);
    expect(bgBounds(next)).not.toEqual({ begin: 3, end: 7 });
    expect(bgBounds(next)).toEqual({ begin: 0, end: 2 });
  });

  it("clears the background when the update clears backgroundText", () => {
    const prev = lineSyncedBgLine();
    const next = reconcileUpdate(prev, { backgroundText: undefined, backgroundTextSource: undefined });
    expect(bgVoice(next)).toBeNull();
  });

  it("leaves a word-synced background intact through a non-background update", () => {
    const prev = reconcileLine({
      id: "L1",
      text: "Real line",
      agentId: "v1",
      words: [
        { text: "Real ", begin: 0, end: 1 },
        { text: "line", begin: 1, end: 2 },
      ],
      backgroundText: "ooh ahh",
      backgroundWords: [
        { text: "ooh ", begin: 0, end: 1 },
        { text: "ahh", begin: 1, end: 2 },
      ],
      backgroundTextSource: "extraction",
    });
    const next = reconcileUpdate(prev, { agentId: "v2" });
    expect(bgWords(next)).toEqual([
      { text: "ooh ", begin: 0, end: 1 },
      { text: "ahh", begin: 1, end: 2 },
    ]);
  });

  it("leaves an untimed background intact through a non-background update", () => {
    const prev = reconcileLine({ id: "L1", text: "Real line", agentId: "v1", backgroundText: "ooh" });
    const next = reconcileUpdate(prev, { agentId: "v2" });
    expect(bgText(next)).toBe("ooh");
    expect(bgWords(next)).toBeUndefined();
    expect(bgBounds(next)).toBeNull();
  });

  it("is a no-op for a line with no background", () => {
    const prev = reconcileLine({ id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 10 });
    const next = reconcileUpdate(prev, { agentId: "v2" });
    expect(bgVoice(next)).toBeNull();
    expect("background" in next).toBe(false);
  });
});

describe("reconcileUpdate · invariants", () => {
  it("does not mutate the input line", () => {
    const prev = lineSyncedBgLine();
    const snapshot = structuredClone(prev);
    reconcileUpdate(prev, { words: [{ text: "Real line", begin: 2, end: 10 }] });
    expect(prev).toEqual(snapshot);
  });

  it("keeps main words intact when only the background follows", () => {
    const prev = lineSyncedBgLine();
    const words = [
      { text: "Real ", begin: 2, end: 5 },
      { text: "line", begin: 5, end: 10 },
    ];
    const next = reconcileUpdate(prev, { words });
    expect(mainWords(next)).toEqual(words);
  });
});
