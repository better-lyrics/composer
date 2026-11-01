import { describe, expect, it, vi } from "vitest";
import { lamePrimingDecode, parseLamePriming, primingCrop, primingToCrop } from "@/audio/lame-priming";

// -- Real LAME tag frames --------------------------------------------------------

interface LameTagOptions {
  tag?: "Xing" | "Info";
  frameCount?: number;
  flags?: number;
  encoderDelay?: number;
  padding?: number;
  version?: "mpeg1" | "mpeg2";
}

// Byte layout written by LAME 3.100 and Lavc: Xing flags, the fields they declare, then the LAME extension.
function buildLameTagFrame({
  tag = "Info",
  frameCount,
  flags = frameCount === undefined ? 0x0e : 0x0f,
  encoderDelay = 576,
  padding = 1260,
  version = "mpeg1",
}: LameTagOptions = {}): Uint8Array {
  const frame = new Uint8Array(417);
  const view = new DataView(frame.buffer);
  frame[0] = 0xff;
  frame[1] = 0xe0 | ((version === "mpeg1" ? 0x03 : 0x02) << 3) | (0x01 << 1) | 0x01;
  frame[2] = 0x90;
  frame[3] = 0x01 << 6;
  const tagOffset = version === "mpeg1" ? 0x24 : 0x15;
  frame.set(new TextEncoder().encode(tag), tagOffset);
  view.setUint32(tagOffset + 4, flags);
  if (flags & 0x01) view.setUint32(tagOffset + 8, frameCount ?? 0);
  const fieldSizes = [4, 4, 100, 4];
  const lameOffset = fieldSizes.reduce(
    (offset, size, bit) => (flags & (1 << bit) ? offset + size : offset),
    tagOffset + 8,
  );
  frame.set(new TextEncoder().encode("LAME3.100"), lameOffset);
  frame[lameOffset + 0x15] = (encoderDelay >> 4) & 0xff;
  frame[lameOffset + 0x16] = ((encoderDelay & 0x0f) << 4) | ((padding >> 8) & 0x0f);
  frame[lameOffset + 0x17] = padding & 0xff;
  return frame;
}

// 193 frames, delay 576, padding 1260: the 5 s 44.1 kHz files in /tmp/mp3-priming decode to 220500 samples.
const CBR_TAG = buildLameTagFrame({ frameCount: 193 });
const SOURCE_LENGTH = 193 * 1152 - 576 - 1260;
const UNTRIMMED_LENGTH = 193 * 1152;

describe("parseLamePriming tag fields", () => {
  it("reads the frame count, padding and frame size of a CBR Info tag", () => {
    expect(parseLamePriming(CBR_TAG)).toEqual({
      samples: 576 + 528,
      sampleRate: 44_100,
      encoderDelay: 576,
      padding: 1260,
      frameCount: 193,
      samplesPerFrame: 1152,
      legacySamples: 576 + 528,
    });
  });

  it("reads the same fields from a VBR Xing tag", () => {
    const vbr = buildLameTagFrame({ tag: "Xing", frameCount: 210, padding: 1344 });
    expect(parseLamePriming(vbr)).toMatchObject({ frameCount: 210, padding: 1344, encoderDelay: 576 });
  });

  it("has no frame count when the frames flag is not set", () => {
    expect(parseLamePriming(buildLameTagFrame()).frameCount).toBeNull();
  });

  it("uses 576 samples per frame for MPEG 2", () => {
    const mpeg2 = buildLameTagFrame({ version: "mpeg2", frameCount: 10 });
    expect(parseLamePriming(mpeg2)).toMatchObject({ sampleRate: 22_050, samplesPerFrame: 576, frameCount: 10 });
  });

  describe("LAME extension offset", () => {
    it("regression: finds the LAME extension right after a frames-only Xing header", () => {
      const frame = new Uint8Array(417);
      frame.set([0xff, 0xfb, 0x90, 0x40], 0);
      frame.set(new TextEncoder().encode("Xing"), 0x24);
      frame[0x24 + 7] = 0x01;
      frame[0x24 + 11] = 50;
      const lameOffset = 0x24 + 12;
      frame[lameOffset + 0x15] = 0x24;
      frame[lameOffset + 0x16] = 0x00;
      expect(parseLamePriming(frame)).toMatchObject({ encoderDelay: 576, frameCount: 50 });
    });

    it.each([0x00, 0x01, 0x03, 0x05, 0x0b, 0x0e])("reads delay and padding with Xing flags %i", (flags) => {
      const frame = buildLameTagFrame({ flags, frameCount: 193, encoderDelay: 1105, padding: 700 });
      expect(parseLamePriming(frame)).toMatchObject({
        samples: 1105 + 528,
        encoderDelay: 1105,
        padding: 700,
        frameCount: flags & 0x01 ? 193 : null,
      });
    });
  });
});

describe("lamePrimingDecode and primingToCrop", () => {
  const priming = parseLamePriming(CBR_TAG);

  it("does not crop a decode the browser already trimmed", () => {
    const decoded = { length: SOURCE_LENGTH, sampleRate: 44_100 };
    expect(lamePrimingDecode(priming, decoded)).toBe("trimmed");
    expect(primingToCrop(priming, decoded)).toBe(0);
  });

  it("does not crop a trimmed decode resampled to another rate", () => {
    expect(primingToCrop(priming, { length: 240_000, sampleRate: 48_000 })).toBe(0);
    expect(primingToCrop(priming, { length: 239_999, sampleRate: 48_000 })).toBe(0);
  });

  it("crops delay + 528 from an untrimmed decode, at the decoded rate", () => {
    expect(lamePrimingDecode(priming, { length: UNTRIMMED_LENGTH, sampleRate: 44_100 })).toBe("untrimmed");
    expect(primingToCrop(priming, { length: UNTRIMMED_LENGTH, sampleRate: 44_100 })).toBe(1104);
    expect(primingToCrop(priming, { length: 241_999, sampleRate: 48_000 })).toBe(Math.round((1104 * 48_000) / 44_100));
  });

  it("converts the crop to the output rate", () => {
    expect(primingToCrop(priming, { length: UNTRIMMED_LENGTH, sampleRate: 44_100 }, 22_050)).toBe(552);
  });

  describe("edge cases", () => {
    it("reports none and crops nothing without a tag, silently", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const none = parseLamePriming(new Uint8Array(4));
      expect(lamePrimingDecode(none, { length: 1000, sampleRate: 44_100 })).toBe("none");
      expect(primingToCrop(none, { length: 1000, sampleRate: 44_100 })).toBe(0);
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it("crops nothing and warns once when the tag has no frame count", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const noFrames = parseLamePriming(buildLameTagFrame());
      expect(primingToCrop(noFrames, { length: UNTRIMMED_LENGTH, sampleRate: 44_100 })).toBe(0);
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });

    it("crops nothing and warns once when the length matches neither", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(lamePrimingDecode(priming, { length: 200_000, sampleRate: 44_100 })).toBe("unknown");
      expect(primingToCrop(priming, { length: 200_000, sampleRate: 44_100 })).toBe(0);
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });
  });
});

describe("primingCrop", () => {
  const priming = parseLamePriming(CBR_TAG);
  const P = 1104 / 44_100;

  it("reads what the double-crop build cut and what this build cuts from a trimmed decode", () => {
    expect(primingCrop(priming, { length: SOURCE_LENGTH, sampleRate: 44_100 })).toEqual({
      beforeSeconds: P,
      nowSeconds: 0,
    });
  });

  it("cuts the same from an untrimmed decode", () => {
    expect(primingCrop(priming, { length: UNTRIMMED_LENGTH, sampleRate: 44_100 })).toEqual({
      beforeSeconds: P,
      nowSeconds: P,
    });
  });

  describe("edge cases", () => {
    it("cuts nothing either way without a tag", () => {
      expect(primingCrop(parseLamePriming(new Uint8Array(4)), { length: 1000, sampleRate: 44_100 })).toEqual({
        beforeSeconds: 0,
        nowSeconds: 0,
      });
    });

    it("regression: the old cut still counts for a decode that matches neither length", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(primingCrop(priming, { length: 200_000, sampleRate: 44_100 })).toEqual({
        beforeSeconds: P,
        nowSeconds: 0,
      });
      warn.mockRestore();
    });
  });

  describe("regressions", () => {
    it("regression: reads the old cut at the old fixed offset when the Xing header has only a frame count", () => {
      const framesOnly = buildLameTagFrame({ flags: 0x01, frameCount: 193 });
      const parsed = parseLamePriming(framesOnly);
      expect(parsed.samples).toBe(1104);
      expect(primingCrop(parsed, { length: SOURCE_LENGTH, sampleRate: 44_100 })).toEqual({
        beforeSeconds: 528 / 44_100,
        nowSeconds: 0,
      });
    });
  });
});
