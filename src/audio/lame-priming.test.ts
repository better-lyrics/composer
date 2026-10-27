import { describe, expect, it, vi } from "vitest";
import {
  findFirstMp3FrameOffset,
  lamePrimingDecode,
  parseLamePriming,
  primingCropChanged,
  primingToCrop,
  stripLeading,
} from "@/audio/lame-priming";

// -- Fixtures ------------------------------------------------------------------

type Mode =
  | { version: "mpeg1"; channels: "stereo" | "mono" }
  | { version: "mpeg2"; channels: "stereo" | "mono" }
  | { version: "mpeg25"; channels: "stereo" | "mono" };

function versionBitsFor(mode: Mode): number {
  if (mode.version === "mpeg1") return 0x03;
  if (mode.version === "mpeg2") return 0x02;
  return 0x00;
}

function channelBitsFor(mode: Mode): number {
  return mode.channels === "mono" ? 0x03 : 0x01;
}

function tagOffsetFor(mode: Mode): number {
  if (mode.version === "mpeg1" && mode.channels === "stereo") return 0x24;
  if (mode.version === "mpeg1") return 0x15;
  if (mode.channels === "stereo") return 0x15;
  return 0x0d;
}

function buildFrame(mode: Mode, encoderDelay: number, tag: "Xing" | "Info" = "Info"): Uint8Array {
  const frame = new Uint8Array(417);
  const sync = 0xe0 | (versionBitsFor(mode) << 3) | (0x01 << 1) | 0x01;
  frame[0] = 0xff;
  frame[1] = sync;
  frame[2] = 0x90;
  frame[3] = channelBitsFor(mode) << 6;
  const tagOffset = tagOffsetFor(mode);
  const tagBytes = new TextEncoder().encode(tag);
  frame.set(tagBytes, tagOffset);
  frame[tagOffset + 7] = 0x0f;
  const lameOffset = tagOffset + 0x78;
  const delayHigh = (encoderDelay >> 4) & 0xff;
  const mixed = ((encoderDelay & 0x0f) << 4) | 0;
  frame[lameOffset + 0x15] = delayHigh;
  frame[lameOffset + 0x16] = mixed;
  return frame;
}

function buildMp3FrameHeader(): Uint8Array {
  const frame = buildFrame({ version: "mpeg1", channels: "stereo" }, 0);
  return frame.slice(0, 4);
}

function buildXingTagFrame(encoderDelay: number, tag: "Xing" | "Info" = "Info"): Uint8Array {
  return buildFrame({ version: "mpeg1", channels: "stereo" }, encoderDelay, tag);
}

function withId3v2Prefix(payload: Uint8Array, sizeBytes = 100): Uint8Array {
  const header = new Uint8Array(10 + sizeBytes);
  header.set(new TextEncoder().encode("ID3"), 0);
  header[3] = 3;
  header[6] = (sizeBytes >> 21) & 0x7f;
  header[7] = (sizeBytes >> 14) & 0x7f;
  header[8] = (sizeBytes >> 7) & 0x7f;
  header[9] = sizeBytes & 0x7f;
  const out = new Uint8Array(header.length + payload.length);
  out.set(header, 0);
  out.set(payload, header.length);
  return out;
}

// -- Tests ---------------------------------------------------------------------

describe("parseLamePriming", () => {
  it("returns samples 1105 + 528 and sampleRate 44100 for a CBR Info tag", () => {
    const frame = buildXingTagFrame(1105, "Info");
    expect(parseLamePriming(frame.buffer)).toMatchObject({ samples: 1105 + 528, sampleRate: 44_100 });
  });

  it("returns samples 2257 + 528 and sampleRate 44100 for a VBR Xing tag", () => {
    const frame = buildXingTagFrame(2257, "Xing");
    expect(parseLamePriming(frame.buffer)).toMatchObject({ samples: 2257 + 528, sampleRate: 44_100 });
  });

  it("skips an ID3v2 header before locating the frame", () => {
    const frame = buildXingTagFrame(1105, "Info");
    const withHeader = withId3v2Prefix(frame, 100);
    expect(parseLamePriming(withHeader.buffer)).toMatchObject({ samples: 1105 + 528, sampleRate: 44_100 });
  });
});

describe("parseLamePriming across MPEG versions and channel modes", () => {
  it("parses MPEG-1 mono with the Xing tag at offset 0x15", () => {
    const frame = buildFrame({ version: "mpeg1", channels: "mono" }, 576);
    expect(parseLamePriming(frame.buffer)).toMatchObject({ samples: 576 + 528, sampleRate: 44_100 });
  });

  it("parses MPEG-2 stereo at 22050 Hz with the Xing tag at offset 0x15", () => {
    const frame = buildFrame({ version: "mpeg2", channels: "stereo" }, 480);
    expect(parseLamePriming(frame.buffer)).toMatchObject({ samples: 480 + 528, sampleRate: 22_050 });
  });

  it("parses MPEG-2 mono at 22050 Hz with the Xing tag at offset 0x0D", () => {
    const frame = buildFrame({ version: "mpeg2", channels: "mono" }, 320);
    expect(parseLamePriming(frame.buffer)).toMatchObject({ samples: 320 + 528, sampleRate: 22_050 });
  });

  it("parses MPEG-2.5 stereo at 11025 Hz with the Xing tag at offset 0x15", () => {
    const frame = buildFrame({ version: "mpeg25", channels: "stereo" }, 480);
    expect(parseLamePriming(frame.buffer)).toMatchObject({ samples: 480 + 528, sampleRate: 11_025 });
  });
});

describe("parseLamePriming edge cases", () => {
  it("returns zero priming for non-MP3 bytes", () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
    expect(parseLamePriming(bytes.buffer)).toMatchObject({ samples: 0, sampleRate: 0 });
  });

  it("returns zero priming when an MP3 frame header is present but no Xing/Info tag follows", () => {
    const frame = new Uint8Array(417);
    frame.set(buildMp3FrameHeader(), 0);
    expect(parseLamePriming(frame.buffer)).toMatchObject({ samples: 0, sampleRate: 0 });
  });

  it("returns zero priming for a truncated buffer", () => {
    const frame = buildXingTagFrame(1105, "Info");
    const truncated = frame.slice(0, 20);
    expect(parseLamePriming(truncated.buffer)).toMatchObject({ samples: 0, sampleRate: 0 });
  });

  it("accepts the maximum valid 12-bit encoder delay without tripping the hard cap", () => {
    const frame = buildXingTagFrame(0, "Info");
    const tagOffset = 0x24;
    const lameOffset = tagOffset + 0x78;
    frame[lameOffset + 0x15] = 0xff;
    frame[lameOffset + 0x16] = 0xf0;
    expect(parseLamePriming(frame.buffer)).toMatchObject({ samples: 4095 + 528, sampleRate: 44_100 });
  });

  it("accepts a Uint8Array directly", () => {
    const frame = buildXingTagFrame(1105, "Info");
    expect(parseLamePriming(frame)).toMatchObject({ samples: 1105 + 528, sampleRate: 44_100 });
  });

  it("returns zero priming for an empty buffer", () => {
    expect(parseLamePriming(new ArrayBuffer(0))).toMatchObject({ samples: 0, sampleRate: 0 });
  });
});

describe("findFirstMp3FrameOffset", () => {
  it("returns 0 when no ID3 header is present", () => {
    const frame = buildXingTagFrame(1105, "Info");
    expect(findFirstMp3FrameOffset(frame)).toBe(0);
  });

  it("returns 10 + sizeBytes past an ID3v2 header", () => {
    const sizeBytes = 200;
    const frame = buildXingTagFrame(1105, "Info");
    const withHeader = withId3v2Prefix(frame, sizeBytes);
    expect(findFirstMp3FrameOffset(withHeader)).toBe(10 + sizeBytes);
  });

  it("masks the high bit of each ID3v2 size byte per syncsafe spec", () => {
    const payload = buildXingTagFrame(1105, "Info");
    const header = new Uint8Array(10 + payload.length);
    header.set(new TextEncoder().encode("ID3"), 0);
    header[3] = 3;
    header[6] = 0x80;
    header[7] = 0x80;
    header[8] = 0x80;
    header[9] = 0x80;
    const out = new Uint8Array(header.length + payload.length);
    out.set(header, 0);
    out.set(payload, header.length);
    expect(findFirstMp3FrameOffset(out)).toBe(10);
  });
});

describe("stripLeading", () => {
  it("returns the same array references when n is 0", () => {
    const left = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    const right = new Float32Array([0.5, 0.6, 0.7, 0.8]);
    const channels = [left, right];
    const result = stripLeading(channels, 0);
    expect(result[0]).toBe(left);
    expect(result[1]).toBe(right);
  });

  it("slices first 2 samples off each channel when n is 2", () => {
    const left = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    const right = new Float32Array([0.5, 0.6, 0.7, 0.8]);
    const result = stripLeading([left, right], 2);
    expect(Array.from(result[0])).toEqual(Array.from(new Float32Array([0.3, 0.4])));
    expect(Array.from(result[1])).toEqual(Array.from(new Float32Array([0.7, 0.8])));
  });

  it("is a no-op when n is negative", () => {
    const left = new Float32Array([0.1, 0.2, 0.3]);
    const right = new Float32Array([0.4, 0.5, 0.6]);
    const channels = [left, right];
    const result = stripLeading(channels, -5);
    expect(result[0]).toBe(left);
    expect(result[1]).toBe(right);
  });

  it("returns empty channels when n equals channel length", () => {
    const left = new Float32Array([0.1, 0.2, 0.3]);
    const right = new Float32Array([0.4, 0.5, 0.6]);
    const result = stripLeading([left, right], 3);
    expect(result[0].length).toBe(0);
    expect(result[1].length).toBe(0);
  });
});

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

describe("primingCropChanged", () => {
  const priming = parseLamePriming(CBR_TAG);

  it("is true when the old code cropped and the new code does not", () => {
    expect(primingCropChanged(priming, { length: SOURCE_LENGTH, sampleRate: 44_100 })).toBe(true);
  });

  it("is false when both crop the same", () => {
    expect(primingCropChanged(priming, { length: UNTRIMMED_LENGTH, sampleRate: 44_100 })).toBe(false);
    expect(primingCropChanged(parseLamePriming(new Uint8Array(4)), { length: 1000, sampleRate: 44_100 })).toBe(false);
  });

  describe("edge cases", () => {
    it("regression: is true for a decode that matches neither length, which the old code cropped", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(primingCropChanged(priming, { length: 200_000, sampleRate: 44_100 })).toBe(true);
      expect(primingCropChanged(parseLamePriming(buildLameTagFrame()), { length: SOURCE_LENGTH, sampleRate: 44_100 })).toBe(
        true,
      );
      warn.mockRestore();
    });
  });
});
