import {
  AUDIO_FORMATS_PROSE,
  UNSUPPORTED_AUDIO_FILE_MESSAGE,
  isSupportedAudioFile,
} from "@/domain/audio-file/supported-formats";
import { describe, expect, it } from "vitest";

describe("isSupportedAudioFile", () => {
  it("accepts a supported audio type", () => {
    expect(isSupportedAudioFile({ name: "song", type: "audio/mpeg" })).toBe(true);
  });

  it("accepts a supported extension when the browser reports no type", () => {
    expect(isSupportedAudioFile({ name: "song.flac", type: "" })).toBe(true);
  });

  describe("edge cases", () => {
    it("matches the extension case-insensitively", () => {
      expect(isSupportedAudioFile({ name: "SONG.M4A", type: "" })).toBe(true);
    });

    it("rejects an unknown type and extension", () => {
      expect(isSupportedAudioFile({ name: "notes.txt", type: "text/plain" })).toBe(false);
    });

    it("rejects a supported extension that is not at the end", () => {
      expect(isSupportedAudioFile({ name: "song.mp3.txt", type: "" })).toBe(false);
    });
  });
});

describe("copy", () => {
  it("lists every format for people", () => {
    expect(AUDIO_FORMATS_PROSE).toBe("MP3, WAV, M4A, OGG, FLAC");
  });

  it("names every extension in the unsupported file message", () => {
    expect(UNSUPPORTED_AUDIO_FILE_MESSAGE).toBe("Unsupported file type. Use .mp3 .wav .m4a .ogg .flac");
  });
});
