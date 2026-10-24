import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import { createLine } from "@/test/factories";
import { generateTTML, withoutAudioIdentity } from "@/utils/ttml";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const LINES = [createLine({ id: "a", text: "Hello", begin: 1, end: 2 })];

function exported(duration?: number, youtubeVideoId?: string): string {
  return generateTTML({
    metadata: normalizeLoadedMetadata(null),
    agents: DEFAULT_AGENTS,
    lines: LINES,
    duration,
    youtubeVideoId,
  });
}

// -- Tests --------------------------------------------------------------------

describe("withoutAudioIdentity", () => {
  it("makes exports that differ only in audio duration equal", () => {
    expect(withoutAudioIdentity(exported(180))).toBe(withoutAudioIdentity(exported(212.5)));
  });

  it("matches the export written without a duration", () => {
    expect(withoutAudioIdentity(exported(180))).toBe(exported());
  });

  it("makes exports that differ only in the YouTube video ID equal", () => {
    expect(withoutAudioIdentity(exported(180, "dQw4w9WgXcQ"))).toBe(withoutAudioIdentity(exported(180, "9bZkp7q19f0")));
    expect(withoutAudioIdentity(exported(180, "dQw4w9WgXcQ"))).toBe(exported());
  });

  describe("edge cases", () => {
    it("leaves an export without a duration unchanged", () => {
      expect(withoutAudioIdentity(exported())).toBe(exported());
    });

    it("keeps real changes visible", () => {
      const edited = exported(180).replace(">Hello<", ">Hello there<");
      expect(withoutAudioIdentity(edited)).not.toBe(withoutAudioIdentity(exported(180)));
    });
  });

  describe("invariants", () => {
    it("is idempotent", () => {
      const once = withoutAudioIdentity(exported(180, "dQw4w9WgXcQ"));
      expect(withoutAudioIdentity(once)).toBe(once);
    });
  });
});

describe("YouTube video ID export", () => {
  it("writes the video ID as a meta pair for a YouTube source", () => {
    expect(exported(180, "dQw4w9WgXcQ")).toContain('<composer:meta key="ytVideoId" value="dQw4w9WgXcQ"/>');
  });

  it("writes no video ID for other sources", () => {
    expect(exported(180)).not.toContain("ytVideoId");
  });
});
