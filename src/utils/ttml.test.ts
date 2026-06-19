import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Agent } from "@/domain/agent/model";
import { applyBackground, setBackground } from "@/domain/line/background";
import { bgBounds, mainBounds } from "@/domain/line/bounds";
import { reconcileLine, type LyricLine } from "@/domain/line/model";
import { bgSource, bgText, bgVoice, bgWords, lineText, mainWords } from "@/domain/line/voices";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { isLineSynced as isLineSyncedVoice, isWordSynced as isWordSyncedVoice } from "@/domain/voice/predicates";
import { formatTime } from "@/utils/format-time";
import { parseLyricsFile } from "@/utils/lyrics-parsers";
import { generateTTML } from "@/utils/ttml";

const FIXTURE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../test/fixtures/ttml");
const ttmlFixture = (name: string) => readFileSync(resolve(FIXTURE_DIR, `${name}.ttml`), "utf-8");

const baseMetadata: ProjectMetadata = { title: "Test", artist: "", album: "", duration: 60 };
const baseAgents: Agent[] = [{ id: "v1", type: "person", name: "Lead" }];

// Derives the granularity a real caller would pass: "word" when any line has
// main OR background word timing, matching the exporter's effectiveGranularity.
function granularityOf(lines: LyricLine[]): "line" | "word" {
  const anyWord = lines.some((l) => {
    if (isWordSyncedVoice(l.main)) return true;
    const bg = bgVoice(l);
    return bg !== null && isWordSyncedVoice(bg);
  });
  return anyWord ? "word" : "line";
}

function exportLines(lines: LyricLine[], granularity: "line" | "word"): string {
  return generateTTML({ metadata: baseMetadata, agents: baseAgents, lines, granularity });
}

// Pulls the timing attribute off the root <tt> element.
function composerTimingOf(ttml: string): string | null {
  return ttml.match(/composer:timing="([^"]+)"/)?.[1] ?? null;
}

describe("generateTTML · composer:timing from both voices", () => {
  it('emits "Word" when only the background voice is word-synced (line-synced main)', () => {
    let line = reconcileLine({ id: "l1", text: "Take me higher", agentId: "v1", begin: 2, end: 10 });
    line = applyBackground(line, {
      text: "(ooh yeah)",
      words: [
        { text: "(ooh ", begin: 3, end: 4 },
        { text: "yeah)", begin: 4, end: 5 },
      ],
      source: "manual",
    });

    expect(isLineSyncedVoice(line.main)).toBe(true);
    expect(isWordSyncedVoice(bgVoice(line)!)).toBe(true);

    const ttml = exportLines([line], "line");
    expect(composerTimingOf(ttml)).toBe("Word");
  });

  it('emits "Word" when only the main voice is word-synced (no background)', () => {
    const line = reconcileLine({
      id: "l1",
      text: "Hello world",
      agentId: "v1",
      words: [
        { text: "Hello ", begin: 1, end: 1.5 },
        { text: "world", begin: 1.5, end: 2 },
      ],
    });

    const ttml = exportLines([line], "line");
    expect(composerTimingOf(ttml)).toBe("Word");
  });

  it('emits "Line" when neither voice is word-synced (line main + line bg)', () => {
    const result = parseLyricsFile("bg-line-synced.ttml", ttmlFixture("bg-line-synced"));
    for (const line of result.lines) {
      expect(isWordSyncedVoice(line.main)).toBe(false);
      expect(isWordSyncedVoice(bgVoice(line)!)).toBe(false);
    }

    const ttml = exportLines(result.lines, "line");
    expect(composerTimingOf(ttml)).toBe("Line");
  });

  it('emits "Word" across lines when any single line has a word-synced background', () => {
    const plain = reconcileLine({ id: "l1", text: "plain", agentId: "v1", begin: 0, end: 1 });
    let withBgWords = reconcileLine({ id: "l2", text: "lead", agentId: "v1", begin: 2, end: 6 });
    withBgWords = applyBackground(withBgWords, {
      text: "(hey now)",
      words: [
        { text: "(hey ", begin: 3, end: 4 },
        { text: "now)", begin: 4, end: 5 },
      ],
      source: "manual",
    });

    const ttml = exportLines([plain, withBgWords], "line");
    expect(composerTimingOf(ttml)).toBe("Word");
  });
});

describe("generateTTML · line-synced background bounds", () => {
  it("emits the background's own bounds, not the main's, for a line-synced bg", () => {
    let line = reconcileLine({ id: "l1", text: "main line", agentId: "v1", begin: 2, end: 10 });
    line = setBackground(line, { text: "(backing)", begin: 3, end: 7, source: "manual" });

    expect(mainBounds(line)).toEqual({ begin: 2, end: 10 });
    expect(bgBounds(line)).toEqual({ begin: 3, end: 7 });

    const ttml = exportLines([line], "line");
    const xbg = ttml.match(/<span ttm:role="x-bg"><span begin="([^"]+)" end="([^"]+)">/);
    expect(xbg).not.toBeNull();
    expect(xbg![1]).toBe(formatTime(3));
    expect(xbg![2]).toBe(formatTime(7));
  });

  it("preserves the bg-line-synced fixture's own bg bounds, distinct from the main line bounds", () => {
    const result = parseLyricsFile("bg-line-synced.ttml", ttmlFixture("bg-line-synced"));
    const ttml = exportLines(result.lines, "line");

    const spans = [...ttml.matchAll(/<span ttm:role="x-bg"><span begin="([^"]+)" end="([^"]+)">/g)];
    expect(spans).toHaveLength(2);

    expect(spans[0][1]).toBe(formatTime(19));
    expect(spans[0][2]).toBe(formatTime(21));
    expect(spans[1][1]).toBe(formatTime(23));
    expect(spans[1][2]).toBe(formatTime(24.5));

    // The <p> begin/end stay the full main line bounds, distinct from the bg.
    const ps = [...ttml.matchAll(/<p begin="([^"]+)" end="([^"]+)"/g)];
    expect(ps[0][1]).toBe(formatTime(18.234));
    expect(ps[0][2]).toBe(formatTime(21.891));
    expect(ps[1][1]).toBe(formatTime(22.1));
    expect(ps[1][2]).toBe(formatTime(25.4));
  });

  it("falls back to the line timing for an untimed background with no own bounds", () => {
    let line = reconcileLine({ id: "l1", text: "main line", agentId: "v1", begin: 2, end: 8 });
    line = setBackground(line, { text: "(untimed)", source: "manual" });

    expect(bgBounds(line)).toBeNull();

    const ttml = exportLines([line], "line");
    const xbg = ttml.match(/<span ttm:role="x-bg"><span begin="([^"]+)" end="([^"]+)">/);
    expect(xbg).not.toBeNull();
    expect(xbg![1]).toBe(formatTime(2));
    expect(xbg![2]).toBe(formatTime(8));
  });
});

describe("generateTTML · background past main extends the <p> end", () => {
  it("extends the <p> end and the x-bg span end when a line-synced bg runs past the main", () => {
    let line = reconcileLine({ id: "l1", text: "main", agentId: "v1", begin: 2, end: 5 });
    line = setBackground(line, { text: "(late)", begin: 6, end: 8, source: "manual" });

    expect(mainBounds(line)).toEqual({ begin: 2, end: 5 });
    expect(bgBounds(line)).toEqual({ begin: 6, end: 8 });

    const ttml = exportLines([line], "line");

    const p = ttml.match(/<p begin="([^"]+)" end="([^"]+)"/);
    expect(p![1]).toBe(formatTime(2));
    expect(p![2]).toBe(formatTime(8));

    const xbg = ttml.match(/<span ttm:role="x-bg"><span begin="([^"]+)" end="([^"]+)">/);
    expect(xbg![1]).toBe(formatTime(6));
    expect(xbg![2]).toBe(formatTime(8));
  });
});

describe("generateTTML · parse/export/parse round-trip", () => {
  // The exporter intentionally trims the trailing space of the final word (no
  // following word to separate from), and formatTime floors at millisecond
  // precision. Neither is granularity or bounds correction, so text is compared
  // trailing-space-insensitively and timing within a millisecond. The point of
  // this suite is that NO voice is re-granularized on export.
  // formatTime floors at millisecond precision, so a round-trip can shed up to
  // 1ms. Two decimals (within 5ms) tolerates that while still catching any real
  // bounds corruption, which is off by whole seconds.
  const boundsClose = (got: ReturnType<typeof mainBounds>, want: ReturnType<typeof mainBounds>) => {
    expect(got === null).toBe(want === null);
    if (got !== null && want !== null) {
      expect(got.begin).toBeCloseTo(want.begin, 2);
      expect(got.end).toBeCloseTo(want.end, 2);
    }
  };

  function assertWordsPreserved(got: ReturnType<typeof mainWords>, want: ReturnType<typeof mainWords>) {
    expect(got === undefined).toBe(want === undefined);
    if (got === undefined || want === undefined) return;
    expect(got).toHaveLength(want.length);
    for (let i = 0; i < want.length; i++) {
      expect(got[i].text.trimEnd()).toBe(want[i].text.trimEnd());
      expect(got[i].begin).toBeCloseTo(want[i].begin, 2);
      expect(got[i].end).toBeCloseTo(want[i].end, 2);
    }
  }

  function assertVoicePreserved(a: LyricLine, b: LyricLine) {
    expect(lineText(b).trimEnd()).toBe(lineText(a).trimEnd());
    expect(isWordSyncedVoice(b.main)).toBe(isWordSyncedVoice(a.main));
    expect(isLineSyncedVoice(b.main)).toBe(isLineSyncedVoice(a.main));
    assertWordsPreserved(mainWords(b), mainWords(a));
    boundsClose(mainBounds(b), mainBounds(a));

    expect((bgText(b) ?? "").trimEnd()).toBe((bgText(a) ?? "").trimEnd());
    expect(bgSource(b)).toBe(bgSource(a));
    boundsClose(bgBounds(b), bgBounds(a));
    assertWordsPreserved(bgWords(b), bgWords(a));

    const bgA = bgVoice(a);
    const bgB = bgVoice(b);
    expect(bgB === null).toBe(bgA === null);
    if (bgA !== null && bgB !== null) {
      expect(isWordSyncedVoice(bgB)).toBe(isWordSyncedVoice(bgA));
      expect(isLineSyncedVoice(bgB)).toBe(isLineSyncedVoice(bgA));
    }
  }

  function roundTrip(fixture: string) {
    const model1 = parseLyricsFile(`${fixture}.ttml`, ttmlFixture(fixture)).lines;
    const ttml = exportLines(model1, granularityOf(model1));
    const model2 = parseLyricsFile(`${fixture}.ttml`, ttml).lines;

    expect(model2).toHaveLength(model1.length);
    for (let i = 0; i < model1.length; i++) {
      assertVoicePreserved(model1[i], model2[i]);
    }
    return { model1, model2 };
  }

  it("word-main + word-bg round-trips with no correction", () => {
    const { model1 } = roundTrip("bg-word-synced");
    for (const line of model1) {
      expect(isWordSyncedVoice(line.main)).toBe(true);
      expect(isWordSyncedVoice(bgVoice(line)!)).toBe(true);
    }
  });

  it("line-main + line-bg round-trips with no correction", () => {
    const { model1 } = roundTrip("bg-line-synced");
    for (const line of model1) {
      expect(isLineSyncedVoice(line.main)).toBe(true);
      expect(isLineSyncedVoice(bgVoice(line)!)).toBe(true);
    }
  });

  it("word-main + line-bg (L1) and line-main + word-bg (L2) round-trip with no correction", () => {
    const { model1 } = roundTrip("bg-mixed-granularity");

    const [l1, l2] = model1;
    expect(isWordSyncedVoice(l1.main)).toBe(true);
    expect(isLineSyncedVoice(bgVoice(l1)!)).toBe(true);

    expect(isLineSyncedVoice(l2.main)).toBe(true);
    expect(isWordSyncedVoice(bgVoice(l2)!)).toBe(true);
  });
});
