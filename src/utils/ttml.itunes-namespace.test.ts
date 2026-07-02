import type { Agent } from "@/domain/agent/model";
import type { LyricLine } from "@/domain/line/model";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { generateTTML } from "@/utils/ttml";
import { describe, expect, it } from "vitest";

const ITUNES_NS = "http://music.apple.com/lyric-ttml-internal";
const baseMetadata: ProjectMetadata = { title: "Test", artist: "", album: "", duration: 60 };
const baseAgents: Agent[] = [{ id: "v1", type: "person", name: "Lead" }];

const wordLine: LyricLine = {
  id: "a",
  text: "hello world",
  agentId: "v1",
  words: [
    { text: "hello ", begin: 1, end: 1.5 },
    { text: "world", begin: 1.5, end: 2 },
  ],
};

const lineSyncedLine: LyricLine = { id: "b", text: "hello world", agentId: "v1", begin: 1, end: 2 };

describe("ttml export · itunes namespace signal", () => {
  it("declares the itunes namespace on the root element", () => {
    const ttml = generateTTML({ metadata: baseMetadata, agents: baseAgents, lines: [wordLine], granularity: "word" });
    expect(ttml).toContain(`xmlns:itunes="${ITUNES_NS}"`);
  });

  it('emits itunes:timing="Word" when any line has word timing', () => {
    const ttml = generateTTML({ metadata: baseMetadata, agents: baseAgents, lines: [wordLine], granularity: "word" });
    expect(ttml).toContain('itunes:timing="Word"');
  });

  it('emits itunes:timing="Line" for a line-synced-only song', () => {
    const ttml = generateTTML({
      metadata: baseMetadata,
      agents: baseAgents,
      lines: [lineSyncedLine],
      granularity: "line",
    });
    expect(ttml).toContain('itunes:timing="Line"');
    expect(ttml).not.toContain('itunes:timing="Word"');
  });

  it("keeps itunes:timing equal to composer:timing (both are durable detection signals)", () => {
    const word = generateTTML({ metadata: baseMetadata, agents: baseAgents, lines: [wordLine], granularity: "word" });
    expect(word).toContain('itunes:timing="Word"');
    expect(word).toContain('composer:timing="Word"');

    const line = generateTTML({
      metadata: baseMetadata,
      agents: baseAgents,
      lines: [lineSyncedLine],
      granularity: "line",
    });
    expect(line).toContain('itunes:timing="Line"');
    expect(line).toContain('composer:timing="Line"');
  });

  describe("edge cases", () => {
    it('reflects actual data, not the granularity prop: word prop + no word timing exports "Line"', () => {
      const ttml = generateTTML({
        metadata: baseMetadata,
        agents: baseAgents,
        lines: [lineSyncedLine],
        granularity: "word",
      });
      expect(ttml).toContain('itunes:timing="Line"');
      expect(ttml).not.toContain('itunes:timing="Word"');
    });

    it("emits both the namespace and the timing attribute together on an empty project", () => {
      const ttml = generateTTML({ metadata: baseMetadata, agents: baseAgents, lines: [], granularity: "line" });
      expect(ttml).toContain(`xmlns:itunes="${ITUNES_NS}"`);
      expect(ttml).toContain('itunes:timing="Line"');
    });
  });
});

describe("ttml export · Apple Music dialect regressions", () => {
  it("emits absolute span times, not offsets relative to the parent line", () => {
    const ttml = generateTTML({
      metadata: baseMetadata,
      agents: baseAgents,
      lines: [
        {
          id: "a",
          text: "hi there",
          agentId: "v1",
          words: [
            { text: "hi ", begin: 65.5, end: 66 },
            { text: "there", begin: 66, end: 66.75 },
          ],
        },
      ],
      granularity: "word",
    });
    // spans carry absolute media times, not offsets measured from the line begin
    expect(ttml).toContain('<span begin="1:05.500"');
    expect(ttml).toContain('begin="1:06.000"');
    // the relative form (word start minus line begin) would be 0:00.500, and must never appear
    expect(ttml).not.toContain('begin="0:00.500"');
  });

  it("marks the Apple dialect with itunes:timing and the itunes namespace", () => {
    const ttml = generateTTML({ metadata: baseMetadata, agents: baseAgents, lines: [wordLine], granularity: "word" });
    expect(ttml).toContain(`xmlns:itunes="${ITUNES_NS}"`);
    expect(ttml).toContain('itunes:timing="Word"');
  });

  it("keeps composer:timing alongside itunes:timing", () => {
    const ttml = generateTTML({ metadata: baseMetadata, agents: baseAgents, lines: [wordLine], granularity: "word" });
    expect(ttml).toContain('composer:timing="Word"');
    expect(ttml).toContain('itunes:timing="Word"');
  });

  it("keeps unpadded M:SS timestamps and does not promote to strict HH:MM:SS", () => {
    const ttml = generateTTML({
      metadata: baseMetadata,
      agents: baseAgents,
      lines: [
        { id: "a", text: "hi", agentId: "v1", words: [{ text: "hi", begin: 65.25, end: 66 }] },
        { id: "b", text: "yo", agentId: "v1", words: [{ text: "yo", begin: 3665.25, end: 3666 }] },
      ],
      granularity: "word",
    });
    // single-digit minutes stay unpadded (1:05.250, never 01:05.250)
    expect(ttml).toContain('begin="1:05.250"');
    // past an hour the minutes overflow (61:05) instead of gaining an HH field
    expect(ttml).toContain('begin="61:05.250"');
    // never strict clock-time HH:MM:SS anywhere in the document
    expect(ttml).not.toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});
