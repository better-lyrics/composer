import { describe, expect, it } from "vitest";
import { effectiveBounds } from "@/domain/line/bounds";
import { parseLyricsFile } from "@/utils/lyrics-parsers";
import { parseLrcClock } from "@/utils/lyrics-parsers/lrc";
import { skippedLineCount } from "@/utils/lyrics-parsers/shared";

const RUMORS_LRC = `[ti:Rumors]
[ar:Test Artist]
[00:05.00]I heard the rumors going round
[00:09.50]They say you're leaving town
[00:14.00]But I don't believe a word
[00:18.20]Of anything I've heard
[00:22.00]
[00:25.00]Oh oh oh (oh oh)
[00:28.00]Rumors, rumors
`;

const ENHANCED_LRC = `[00:01.00]<00:01.00>Hello <00:01.50>world <00:02.00>again
[00:03.00]<00:03.00>Second <00:03.60>line <00:04.10>here
`;

const WEIRD_LRC = `[00:99.99]Invalid time
[aa:bb.cc]garbage
plain line no timestamp
[00:01.00]valid
`;

describe("parseLrcClock", () => {
  it("reads a two digit fraction as hundredths", () => {
    expect(parseLrcClock("01", "02", "50")).toBeCloseTo(62.5, 3);
  });

  it("reads a three digit fraction as milliseconds", () => {
    expect(parseLrcClock("00", "05", "125")).toBeCloseTo(5.125, 3);
  });

  it("reads a clock with no fraction", () => {
    expect(parseLrcClock("2", "00")).toBe(120);
  });

  it("accepts 59.99 seconds", () => {
    expect(parseLrcClock("00", "59", "99")).toBeCloseTo(59.99, 3);
  });

  it("rejects 60.00 seconds", () => {
    expect(parseLrcClock("00", "60", "00")).toBeNull();
  });

  it("rejects 99 seconds", () => {
    expect(parseLrcClock("00", "99", "99")).toBeNull();
  });
});

describe("parseLyricsFile - LRC separators", () => {
  it("accepts a colon before the fraction", () => {
    const result = parseLyricsFile("song.lrc", "[00:01:50]First\n[00:03.00]Second", 10);
    expect(result.lines[0].begin).toBeCloseTo(1.5, 3);
  });
});

describe("T6 LRC empty timed line", () => {
  it("ends the line before an empty [00:22.00] marker at 22 s", () => {
    const parsed = parseLyricsFile("rumors.lrc", RUMORS_LRC, 30);
    const anything = parsed.lines.find((line) => line.text.startsWith("Of anything"));
    expect(anything && effectiveBounds(anything)?.end).toBe(22);
  });

  it("does not emit the gap marker as a lyric line", () => {
    const parsed = parseLyricsFile("rumors.lrc", RUMORS_LRC, 30);
    expect(parsed.lines.map((line) => line.text)).not.toContain("");
    expect(parsed.lines).toHaveLength(6);
  });

  it("ends the last line at a trailing gap marker", () => {
    const parsed = parseLyricsFile("song.lrc", "[00:01.00]Only line\n[00:04.00]", 30);
    expect(parsed.lines).toHaveLength(1);
    expect(parsed.lines[0].end).toBe(4);
  });
});

describe("T7 enhanced LRC last word", () => {
  it("does not import the last word of the song zero-length", () => {
    const parsed = parseLyricsFile("enhanced.lrc", ENHANCED_LRC, 30);
    const lastLine = parsed.lines[parsed.lines.length - 1];
    const lastWord = lastLine.words?.[lastLine.words.length - 1];
    expect(lastWord?.text).toBe("here");
    expect((lastWord?.end ?? 0) - (lastWord?.begin ?? 0)).toBeGreaterThan(0);
  });

  it("ends the last word at the audio duration when nothing else follows", () => {
    const parsed = parseLyricsFile("enhanced.lrc", ENHANCED_LRC, 30);
    const lastLine = parsed.lines[parsed.lines.length - 1];
    expect(lastLine.words?.[lastLine.words.length - 1].end).toBe(30);
  });

  it("gives the last word a positive length with no duration at all", () => {
    const parsed = parseLyricsFile("enhanced.lrc", ENHANCED_LRC);
    const lastLine = parsed.lines[parsed.lines.length - 1];
    const lastWord = lastLine.words?.[lastLine.words.length - 1];
    expect((lastWord?.end ?? 0) - (lastWord?.begin ?? 0)).toBeGreaterThan(0);
  });
});

describe("T13 invalid LRC timestamps", () => {
  it("rejects [00:99.99] instead of reading it as 1:39.99", () => {
    const parsed = parseLyricsFile("weird.lrc", WEIRD_LRC, 200);
    expect(parsed.lines.some((line) => line.begin === 99.99)).toBe(false);
  });

  it("reports rejected or untimed LRC lines instead of dropping them silently", () => {
    const parsed = parseLyricsFile("weird.lrc", WEIRD_LRC, 200);
    expect(parsed.issues).toEqual([
      { line: 1, text: "[00:99.99]Invalid time", reason: "invalid-timestamp" },
      { line: 2, text: "[aa:bb.cc]garbage", reason: "unparsed" },
      { line: 3, text: "plain line no timestamp", reason: "unparsed" },
    ]);
    expect(parsed.lines.map((line) => line.text)).toEqual(["valid"]);
  });

  it("does not report metadata tags", () => {
    const parsed = parseLyricsFile("rumors.lrc", `[offset:+100]\n${RUMORS_LRC}`, 30);
    expect(parsed.issues).toEqual([]);
  });

  it("keeps the valid tags of a line that also carries an invalid one", () => {
    const parsed = parseLyricsFile("song.lrc", "[00:01.00][00:75.00]Chorus\n[00:05.00]Next", 10);
    expect(parsed.lines.filter((line) => line.text === "Chorus")).toHaveLength(1);
    expect(parsed.issues).toEqual([{ line: 1, text: "[00:01.00][00:75.00]Chorus", reason: "ignored-timestamp" }]);
  });

  it("reports a line skipped for an invalid inline clock even when a line tag was also ignored", () => {
    const parsed = parseLyricsFile("song.lrc", "[00:01.00][00:75.00]<00:01.00>Hi <00:61.00>there\n[00:05.00]Next", 10);
    expect(parsed.lines.map((line) => line.text)).toEqual(["Next"]);
    expect(skippedLineCount(parsed.issues)).toBe(1);
  });

  it("reports an invalid inline word clock and skips the line", () => {
    const parsed = parseLyricsFile("song.lrc", "[00:01.00]<00:01.00>Hi <00:61.00>there\n[00:05.00]Next", 10);
    expect(parsed.lines.map((line) => line.text)).toEqual(["Next"]);
    expect(parsed.issues[0]?.reason).toBe("invalid-timestamp");
  });

  it("ignores an invalid [length:] tag", () => {
    const parsed = parseLyricsFile("song.lrc", "[length:00:70.00]\n[00:01.00]Only", 20);
    expect(parsed.lines[0].end).toBe(20);
  });
});

describe("LRC metadata tags with an empty value", () => {
  it("does not report an empty [by:] tag as unparsed", () => {
    const parsed = parseLyricsFile("song.lrc", "[by:]\n[00:01.00]Only", 10);
    expect(parsed.issues).toEqual([]);
    expect(parsed.lines.map((line) => line.text)).toEqual(["Only"]);
  });

  it("does not write an empty title or artist", () => {
    const parsed = parseLyricsFile("song.lrc", "[ti:]\n[ar: ]\n[00:01.00]Only", 10);
    expect(parsed.metadata).toEqual({});
  });

  it("still reports a section label as unparsed", () => {
    const parsed = parseLyricsFile("song.lrc", "[Chorus]\n[00:01.00]Only", 10);
    expect(parsed.issues).toEqual([{ line: 1, text: "[Chorus]", reason: "unparsed" }]);
  });
});
