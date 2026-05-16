import { decodeMp3ToWav } from "@/audio/audio-decode";
import { createMp3File } from "@/test/audio-fixtures";
import { describe, expect, it } from "vitest";

describe("decodeMp3ToWav", () => {
  it("decodes an mp3 file into a valid wav blob", async () => {
    const blob = await decodeMp3ToWav(createMp3File());
    expect(blob.type).toBe("audio/wav");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe("WAVE");
  });

  it("produces wav that itself decodes back to playable audio", async () => {
    const blob = await decodeMp3ToWav(createMp3File());
    const ctx = new AudioContext();
    try {
      const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
      expect(decoded.numberOfChannels).toBeGreaterThan(0);
      expect(decoded.sampleRate).toBeGreaterThan(0);
      expect(decoded.duration).toBeGreaterThan(0.1);
    } finally {
      await ctx.close();
    }
  });

  it("rejects a file that is not decodable audio", async () => {
    const garbage = new File([new Uint8Array([1, 2, 3, 4, 5])], "broken.mp3", { type: "audio/mpeg" });
    await expect(decodeMp3ToWav(garbage)).rejects.toBeTruthy();
  });
});
