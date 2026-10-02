import { projectAudioStatus, storedAudioBytesTotal } from "@/domain/project/audio-status";
import { describe, expect, it } from "vitest";

describe("projectAudioStatus", () => {
  it("reports a stored file with its format and size", () => {
    expect(projectAudioStatus({ audioKind: "file", storedAudioBytes: 41_800_000, audioFileName: "song.flac" })).toEqual(
      {
        kind: "file",
        format: "FLAC",
        bytes: 41_800_000,
      },
    );
  });

  it("reports YouTube whether or not audio is cached", () => {
    expect(projectAudioStatus({ audioKind: "youtube", storedAudioBytes: 0 })).toEqual({ kind: "youtube" });
    expect(projectAudioStatus({ audioKind: "youtube", storedAudioBytes: 900 })).toEqual({ kind: "youtube" });
  });

  it("reports a file project without stored bytes as missing, with its name", () => {
    expect(projectAudioStatus({ audioKind: "file", storedAudioBytes: 0, audioFileName: "die.wav" })).toEqual({
      kind: "missing",
      fileName: "die.wav",
    });
  });

  describe("edge cases", () => {
    it("reports no audio", () => {
      expect(projectAudioStatus({ audioKind: "none", storedAudioBytes: 0 })).toEqual({ kind: "none" });
    });

    it("labels a stored file saved before audioFileName existed as File", () => {
      expect(projectAudioStatus({ audioKind: "file", storedAudioBytes: 10 })).toEqual({
        kind: "file",
        format: "File",
        bytes: 10,
      });
    });

    it("omits the name of a missing file saved before audioFileName existed", () => {
      expect(projectAudioStatus({ audioKind: "file", storedAudioBytes: 0 })).toEqual({ kind: "missing" });
    });
  });
});

describe("storedAudioBytesTotal", () => {
  it("adds up the stored bytes", () => {
    expect(storedAudioBytesTotal([{ storedAudioBytes: 10 }, { storedAudioBytes: 0 }, { storedAudioBytes: 5 }])).toBe(
      15,
    );
    expect(storedAudioBytesTotal([])).toBe(0);
  });
});
