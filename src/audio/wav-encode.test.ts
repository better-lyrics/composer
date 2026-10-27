import { hashFile } from "@/audio/separation/audio-codec";
import { encodeWav, withLeadingSilence } from "@/audio/wav-encode";
import {
  GOLDEN_MONO_WAV_SHA256,
  GOLDEN_STEREO_WAV_SHA256,
  goldenMonoInput,
  goldenStereoInput,
} from "@/test/wav-golden";
import { describe, expect, it } from "vitest";

function ascii(view: DataView, offset: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

function wavView(channels: number[][], sampleRate = 44100): DataView {
  return new DataView(
    encodeWav(
      channels.map((channel) => Float32Array.from(channel)),
      sampleRate,
    ),
  );
}

describe("encodeWav", () => {
  it("writes a valid RIFF/WAVE 16-bit PCM header", () => {
    const view = wavView([[0, 0, 0, 0]], 48000);
    expect(ascii(view, 0, 4)).toBe("RIFF");
    expect(ascii(view, 8, 4)).toBe("WAVE");
    expect(ascii(view, 12, 4)).toBe("fmt ");
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(ascii(view, 36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(8);
  });

  it("clamps and converts float samples to 16-bit ints", () => {
    const view = wavView([[1, -1, 2, -2, 0]]);
    expect([44, 46, 48, 50, 52].map((offset) => view.getInt16(offset, true))).toEqual([
      32767, -32768, 32767, -32768, 0,
    ]);
  });

  it("interleaves stereo channels L,R,L,R", () => {
    const view = wavView([
      [1, 0],
      [0, -1],
    ]);
    expect(view.getUint16(22, true)).toBe(2);
    expect([44, 46, 48, 50].map((offset) => view.getInt16(offset, true))).toEqual([32767, 0, 0, -32768]);
  });

  describe("edge cases", () => {
    it("writes only the header for empty audio", () => {
      expect(encodeWav([new Float32Array(0)], 44100).byteLength).toBe(44);
    });

    it("writes NaN samples as silence", () => {
      expect(wavView([[Number.NaN]]).getInt16(44, true)).toBe(0);
    });
  });

  describe("regressions", () => {
    it("regression: produces the same stereo bytes as before the worker move", async () => {
      const { channels, sampleRate } = goldenStereoInput();
      expect(await hashFile(new Blob([encodeWav(channels, sampleRate)]))).toBe(GOLDEN_STEREO_WAV_SHA256);
    });

    it("regression: produces the same mono bytes as before the worker move", async () => {
      const { channels, sampleRate } = goldenMonoInput();
      expect(await hashFile(new Blob([encodeWav(channels, sampleRate)]))).toBe(GOLDEN_MONO_WAV_SHA256);
    });
  });
});

describe("withLeadingSilence", () => {
  it("prepends silent frames at the file's rate and keeps every original sample", () => {
    const original = encodeWav([Float32Array.from([0.5, -0.5]), Float32Array.from([0.25, -0.25])], 1000);
    const padded = withLeadingSilence(original, 0.003);
    expect(padded).not.toBeNull();
    const view = new DataView(padded as ArrayBuffer);
    expect(view.getUint32(40, true)).toBe(5 * 4);
    expect(view.getUint32(4, true)).toBe(36 + 5 * 4);
    expect(Array.from(new Int16Array((padded as ArrayBuffer).slice(44)))).toEqual([
      0,
      0,
      0,
      0,
      0,
      0,
      ...new Int16Array(original.slice(44)),
    ]);
  });

  describe("edge cases", () => {
    it("returns the same bytes for no silence", () => {
      const original = encodeWav([Float32Array.from([0.5])], 1000);
      expect(withLeadingSilence(original, 0)).toBe(original);
    });

    it("refuses bytes that are not a 16-bit PCM WAV it can extend", () => {
      expect(withLeadingSilence(new Uint8Array([1, 2, 3, 4]).buffer, 0.01)).toBeNull();
      const float = encodeWav([Float32Array.from([0.5])], 1000);
      new DataView(float).setUint16(34, 32, true);
      expect(withLeadingSilence(float, 0.01)).toBeNull();
    });
  });
});
