import { describe, expect, it } from "vitest";
import { probeAudioFile } from "@/audio/probe-audio-file";
import { createAudioFile, createMp3File } from "@/test/audio-fixtures";

describe("probeAudioFile", () => {
  it("accepts a playable WAV and reports its duration", async () => {
    const result = await probeAudioFile(createAudioFile());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.duration).toBeCloseTo(0.1, 2);
  });

  it("accepts a playable mp3", async () => {
    const result = await probeAudioFile(createMp3File());
    expect(result.ok).toBe(true);
  });

  describe("error paths", () => {
    it("rejects a text file named .mp3", async () => {
      const fake = new File(["these are lyrics, not audio"], "song.mp3", { type: "audio/mpeg" });
      expect(await probeAudioFile(fake)).toEqual({ ok: false });
    });

    it("rejects an empty file", async () => {
      expect(await probeAudioFile(new File([], "empty.wav", { type: "audio/wav" }))).toEqual({ ok: false });
    });
  });
});
