import { needsWavConversion } from "@/audio/audio-decode";
import { describe, expect, it } from "vitest";

describe("needsWavConversion", () => {
  describe("flagged formats (no native seek tables)", () => {
    it("flags audio/mpeg", () => {
      expect(needsWavConversion(new File([], "x", { type: "audio/mpeg" }))).toBe(true);
    });
    it("flags audio/mp3 (non-canonical but seen in the wild)", () => {
      expect(needsWavConversion(new File([], "x", { type: "audio/mp3" }))).toBe(true);
    });
    it("flags .mp3 by extension regardless of case", () => {
      expect(needsWavConversion(new File([], "Song.MP3"))).toBe(true);
      expect(needsWavConversion(new File([], "track.mp3"))).toBe(true);
    });
    it("flags audio/aac (raw AAC bitstream, no container)", () => {
      expect(needsWavConversion(new File([], "x", { type: "audio/aac" }))).toBe(true);
    });
    it("flags .aac by extension regardless of case", () => {
      expect(needsWavConversion(new File([], "song.aac"))).toBe(true);
      expect(needsWavConversion(new File([], "song.AAC"))).toBe(true);
    });
  });

  describe("formats that DO have seek tables (must NOT be flagged)", () => {
    it("does not flag audio/mp4 — m4a carries AAC inside an MP4 container with seek atoms", () => {
      expect(needsWavConversion(new File([], "x.m4a", { type: "audio/mp4" }))).toBe(false);
    });
    it("does not flag .m4a by name (regression: must not be confused with raw aac)", () => {
      expect(needsWavConversion(new File([], "x.m4a"))).toBe(false);
    });
    it("does not flag audio/opus", () => {
      expect(needsWavConversion(new File([], "x.opus", { type: "audio/opus" }))).toBe(false);
    });
    it("does not flag audio/webm", () => {
      expect(needsWavConversion(new File([], "x.webm", { type: "audio/webm" }))).toBe(false);
    });
    it("does not flag audio/ogg", () => {
      expect(needsWavConversion(new File([], "x.ogg", { type: "audio/ogg" }))).toBe(false);
    });
    it("does not flag audio/wav", () => {
      expect(needsWavConversion(new File([], "x.wav", { type: "audio/wav" }))).toBe(false);
    });
    it("does not flag audio/flac", () => {
      expect(needsWavConversion(new File([], "x.flac", { type: "audio/flac" }))).toBe(false);
    });
  });

  describe("ambiguous cases", () => {
    it("does not flag an unknown extension with no mime", () => {
      expect(needsWavConversion(new File([], "mystery"))).toBe(false);
    });
    it("flags when mime type is mp3 even if extension is misleading", () => {
      expect(needsWavConversion(new File([], "Bad.wav", { type: "audio/mpeg" }))).toBe(true);
    });
    it("flags when extension is mp3 even if mime is missing", () => {
      expect(needsWavConversion(new File([], "Bad.mp3", { type: "" }))).toBe(true);
    });
  });
});
