import { isKeepYouTubeAudio, keepsYouTubeAudio } from "@/domain/storage/audio-retention";
import { describe, expect, it } from "vitest";

describe("keepsYouTubeAudio", () => {
  it("keeps YouTube audio automatically only while Composer Bridge is off", () => {
    expect(keepsYouTubeAudio("auto", false)).toBe(true);
    expect(keepsYouTubeAudio("auto", true)).toBe(false);
  });

  it("always keeps or never keeps whatever the bridge does", () => {
    for (const bridgeEnabled of [true, false]) {
      expect(keepsYouTubeAudio("always", bridgeEnabled)).toBe(true);
      expect(keepsYouTubeAudio("never", bridgeEnabled)).toBe(false);
    }
  });
});

describe("isKeepYouTubeAudio", () => {
  it("accepts the three rules", () => {
    for (const rule of ["auto", "always", "never"]) expect(isKeepYouTubeAudio(rule)).toBe(true);
  });

  describe("edge cases", () => {
    it("rejects anything else", () => {
      for (const value of ["Auto", "sometimes", "", " auto", null, undefined, 1, true, {}]) {
        expect(isKeepYouTubeAudio(value)).toBe(false);
      }
    });
  });
});
