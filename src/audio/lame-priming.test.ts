import { describe, expect, it } from "vitest";
import { findFirstMp3FrameOffset, parseLamePriming, stripLeading } from "@/audio/lame-priming";

// -- Fixtures ------------------------------------------------------------------

function buildMp3FrameHeader(): Uint8Array {
  return new Uint8Array([0xff, 0xfb, 0x90, 0x40]);
}

function buildXingTagFrame(encoderDelay: number, tag: "Xing" | "Info" = "Info"): Uint8Array {
  const frame = new Uint8Array(417);
  frame.set(buildMp3FrameHeader(), 0);
  const tagOffset = 0x24;
  const tagBytes = new TextEncoder().encode(tag);
  frame.set(tagBytes, tagOffset);
  const lameOffset = tagOffset + 0x78;
  const delayHigh = (encoderDelay >> 4) & 0xff;
  const mixed = ((encoderDelay & 0x0f) << 4) | 0;
  frame[lameOffset + 0x15] = delayHigh;
  frame[lameOffset + 0x16] = mixed;
  return frame;
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
  it("returns 1105 + 528 for a CBR Info tag with encoder delay 1105", () => {
    const frame = buildXingTagFrame(1105, "Info");
    expect(parseLamePriming(frame.buffer)).toBe(1105 + 528);
  });

  it("returns 2257 + 528 for a VBR Xing tag with encoder delay 2257", () => {
    const frame = buildXingTagFrame(2257, "Xing");
    expect(parseLamePriming(frame.buffer)).toBe(2257 + 528);
  });

  it("skips an ID3v2 header before locating the frame", () => {
    const frame = buildXingTagFrame(1105, "Info");
    const withHeader = withId3v2Prefix(frame, 100);
    expect(parseLamePriming(withHeader.buffer)).toBe(1105 + 528);
  });
});

describe("parseLamePriming edge cases", () => {
  it("returns 0 for non-MP3 bytes", () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
    expect(parseLamePriming(bytes.buffer)).toBe(0);
  });

  it("returns 0 when an MP3 frame header is present but no Xing/Info tag follows", () => {
    const frame = new Uint8Array(417);
    frame.set(buildMp3FrameHeader(), 0);
    expect(parseLamePriming(frame.buffer)).toBe(0);
  });

  it("returns 0 for a truncated buffer (first 20 bytes of a valid frame)", () => {
    const frame = buildXingTagFrame(1105, "Info");
    const truncated = frame.slice(0, 20);
    expect(parseLamePriming(truncated.buffer)).toBe(0);
  });

  it("accepts the maximum valid 12-bit encoder delay without tripping the hard cap", () => {
    const frame = buildXingTagFrame(0, "Info");
    const tagOffset = 0x24;
    const lameOffset = tagOffset + 0x78;
    frame[lameOffset + 0x15] = 0xff;
    frame[lameOffset + 0x16] = 0xf0;
    expect(parseLamePriming(frame.buffer)).toBe(4095 + 528);
  });

  it("accepts a Uint8Array directly", () => {
    const frame = buildXingTagFrame(1105, "Info");
    expect(parseLamePriming(frame)).toBe(1105 + 528);
  });

  it("returns 0 for an empty buffer", () => {
    expect(parseLamePriming(new ArrayBuffer(0))).toBe(0);
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
