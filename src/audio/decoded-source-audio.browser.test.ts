import { primingDecodeTag, withDecodedSource } from "@/audio/decoded-source-audio";
import { createMp3File, encodeWav, makeSineBuffer } from "@/test/audio-fixtures";
import { allowConsole } from "@/test/console-guard";
import { describe, expect, it, vi } from "vitest";

function sineWav(seconds: number): Blob {
  return new Blob([encodeWav(makeSineBuffer(seconds))], { type: "audio/wav" });
}

describe("withDecodedSource", () => {
  it("decodes a wav source into audio of the same duration", async () => {
    const duration = await withDecodedSource(sineWav(1), (decoded) => decoded.duration);
    expect(duration).toBeCloseTo(1, 1);
  });

  it("regression: does not crop an mp3 the browser already trimmed", async () => {
    const mp3 = createMp3File();
    const bytes = await mp3.arrayBuffer();
    const ctx = new AudioContext();
    const raw = await ctx.decodeAudioData(bytes.slice(0));
    await ctx.close();

    const length = await withDecodedSource(mp3, (decoded) => decoded.channels[0].length);

    expect(length).toBe(raw.length);
  });

  it("regression: tags an mp3 whose decode matches neither tag length, since the old crop changed for it too", async () => {
    allowConsole(/decoded length does not match the LAME tag/);
    const bytes = new Uint8Array(await createMp3File().arrayBuffer());
    const tagOffset = new TextDecoder("latin1").decode(bytes).indexOf("Info");
    new DataView(bytes.buffer).setUint32(tagOffset + 8, 999);
    const mismatched = new File([bytes], "mismatched.mp3", { type: "audio/mpeg" });

    expect(await primingDecodeTag(mismatched)).toBe("lt1");
  });

  it("regression: tags a LAME mp3 from its bytes without decoding it", async () => {
    const decode = vi.spyOn(BaseAudioContext.prototype, "decodeAudioData");
    expect(await primingDecodeTag(createMp3File())).toBe("lt1");
    expect(decode).not.toHaveBeenCalled();
    decode.mockRestore();
  });

  it("tags a LAME mp3 the browser trims and leaves other sources untagged", async () => {
    expect(await primingDecodeTag(createMp3File())).toBe("lt1");
    expect(await primingDecodeTag(sineWav(0.5))).toBe("");
    expect(await primingDecodeTag(new Blob([new Uint8Array([0, 1, 2, 3])]))).toBe("");
  });

  describe("invariants", () => {
    it("runs one decode at a time and keeps none after its use settles", async () => {
      const decode = vi.spyOn(BaseAudioContext.prototype, "decodeAudioData");
      const source = sineWav(0.5);
      let releaseFirst = () => {};
      const firstHeld = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      let secondStarted = false;
      const first = withDecodedSource(source, async (decoded) => {
        await firstHeld;
        return decoded;
      });
      const second = withDecodedSource(source, (decoded) => {
        secondStarted = true;
        return decoded;
      });
      await expect.poll(() => decode.mock.calls.length).toBe(1);
      expect(secondStarted).toBe(false);

      releaseFirst();
      const [firstDecoded, secondDecoded] = await Promise.all([first, second]);

      expect(decode).toHaveBeenCalledTimes(2);
      expect(secondDecoded.audio).not.toBe(firstDecoded.audio);
      decode.mockRestore();
    });
  });

  describe("error paths", () => {
    it("rejects for bytes that are not audio and lets the next use run", async () => {
      const garbage = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/wav" });
      await expect(withDecodedSource(garbage, () => null)).rejects.toBeDefined();
      expect(await withDecodedSource(sineWav(0.5), (decoded) => decoded.duration)).toBeCloseTo(0.5, 1);
    });
  });
});
