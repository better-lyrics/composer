import { describe, expect, it } from "vitest";
import { hasLoadedYouTubeSourceFor, isYouTubeSourceFor } from "@/utils/youtube-source";

// -- Constants ----------------------------------------------------------------

const VIDEO_ID = "dQw4w9WgXcQ";
const OTHER_VIDEO_ID = "9bZkp7q19f0";
const FILE = new File([], "song.mp3");

// -- Tests --------------------------------------------------------------------

describe("isYouTubeSourceFor", () => {
  it("matches a youtube source with the same videoId", () => {
    expect(isYouTubeSourceFor({ type: "youtube", videoId: VIDEO_ID }, VIDEO_ID)).toBe(true);
  });

  it("matches regardless of whether a file is present", () => {
    expect(isYouTubeSourceFor({ type: "youtube", videoId: VIDEO_ID, file: FILE }, VIDEO_ID)).toBe(true);
  });

  describe("edge cases", () => {
    it("rejects a youtube source with a different videoId", () => {
      expect(isYouTubeSourceFor({ type: "youtube", videoId: OTHER_VIDEO_ID }, VIDEO_ID)).toBe(false);
    });

    it("rejects a file source", () => {
      expect(isYouTubeSourceFor({ type: "file", file: FILE }, VIDEO_ID)).toBe(false);
    });

    it("rejects a null source", () => {
      expect(isYouTubeSourceFor(null, VIDEO_ID)).toBe(false);
    });
  });
});

describe("hasLoadedYouTubeSourceFor", () => {
  it("is true once the matching source has a file", () => {
    expect(hasLoadedYouTubeSourceFor({ type: "youtube", videoId: VIDEO_ID, file: FILE }, VIDEO_ID)).toBe(true);
  });

  describe("edge cases", () => {
    it("is false while the matching source has no file yet", () => {
      expect(hasLoadedYouTubeSourceFor({ type: "youtube", videoId: VIDEO_ID }, VIDEO_ID)).toBe(false);
    });

    it("is false for a different videoId even with a file", () => {
      expect(hasLoadedYouTubeSourceFor({ type: "youtube", videoId: OTHER_VIDEO_ID, file: FILE }, VIDEO_ID)).toBe(false);
    });

    it("is false for a null source", () => {
      expect(hasLoadedYouTubeSourceFor(null, VIDEO_ID)).toBe(false);
    });
  });
});
