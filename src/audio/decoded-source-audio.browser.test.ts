import { decodeSourceAudio, primingDecodeTag } from "@/audio/decoded-source-audio";
import { createMp3File, encodeWav, makeSineBuffer } from "@/test/audio-fixtures";
import { allowConsole } from "@/test/console-guard";
import { describe, expect, it } from "vitest";

function sineWav(seconds: number): Blob {
  return new Blob([encodeWav(makeSineBuffer(seconds))], { type: "audio/wav" });
}

describe("decodeSourceAudio", () => {
  it("decodes a wav source into an AudioBuffer of the same duration", async () => {
    const decoded = await decodeSourceAudio(sineWav(1));
    expect(decoded.duration).toBeCloseTo(1, 1);
  });

  it("regression: does not crop an mp3 the browser already trimmed", async () => {
    const mp3 = createMp3File();
    const bytes = await mp3.arrayBuffer();
    const ctx = new AudioContext();
    const raw = await ctx.decodeAudioData(bytes.slice(0));
    await ctx.close();

    const decoded = await decodeSourceAudio(mp3);

    expect(decoded.length).toBe(raw.length);
  });

  it("regression: tags an mp3 whose decode matches neither tag length, since the old crop changed for it too", async () => {
    allowConsole(/decoded length does not match the LAME tag/);
    const bytes = new Uint8Array(await createMp3File().arrayBuffer());
    const tagOffset = new TextDecoder("latin1").decode(bytes).indexOf("Info");
    new DataView(bytes.buffer).setUint32(tagOffset + 8, 999);
    const mismatched = new File([bytes], "mismatched.mp3", { type: "audio/mpeg" });

    expect(await primingDecodeTag(mismatched)).toBe("lt1");
  });

  it("tags a LAME mp3 the browser trims and leaves other sources untagged", async () => {
    expect(await primingDecodeTag(createMp3File())).toBe("lt1");
    expect(await primingDecodeTag(sineWav(0.5))).toBe("");
    expect(await primingDecodeTag(new Blob([new Uint8Array([0, 1, 2, 3])]))).toBe("");
  });

  describe("invariants", () => {
    it("decodes each source once and shares the buffer between callers", async () => {
      const source = sineWav(0.5);
      const [first, second] = await Promise.all([decodeSourceAudio(source), decodeSourceAudio(source)]);
      expect(second).toBe(first);
      expect(await decodeSourceAudio(source)).toBe(first);
    });

    it("keeps different sources apart", async () => {
      const first = await decodeSourceAudio(sineWav(0.5));
      const second = await decodeSourceAudio(sineWav(0.5));
      expect(second).not.toBe(first);
    });
  });

  describe("error paths", () => {
    it("rejects for bytes that are not audio and does not remember the failure", async () => {
      const garbage = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/wav" });
      await expect(decodeSourceAudio(garbage)).rejects.toBeDefined();
      await expect(decodeSourceAudio(garbage)).rejects.toBeDefined();
    });
  });
});
