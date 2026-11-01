import { decodePitchTrack, encodePitchTrack } from "@/audio/pitch/pitch-cache";
import slice from "@/domain/pitch/test-fixtures/pitch-mascara-slice.json";
import type { PitchTrack } from "@/domain/pitch/track";
import { describe, expect, it, vi } from "vitest";

function sliceTrack(frames = slice.f0.length): PitchTrack {
  return {
    hopSeconds: slice.hop,
    startSeconds: slice.t0,
    frequencyHz: Float32Array.from(slice.f0.slice(0, frames)),
    confidencePercent: Uint8Array.from(slice.conf.slice(0, frames)),
    loudnessDb: Int16Array.from(slice.db.slice(0, frames)),
  };
}

describe("pitch cache encoding", () => {
  it("round trips a real track", () => {
    const track = sliceTrack();
    expect(decodePitchTrack(encodePitchTrack(track))).toEqual(track);
  });

  describe("edge cases", () => {
    it("round trips an odd frame count, which pads before loudness", () => {
      const track = sliceTrack(101);
      expect(decodePitchTrack(encodePitchTrack(track))).toEqual(track);
    });

    it("reads a track from a view that does not start at offset 0", () => {
      const track = sliceTrack(50);
      const bytes = encodePitchTrack(track);
      const shifted = new Uint8Array(bytes.length + 3);
      shifted.set(bytes, 3);
      expect(decodePitchTrack(shifted.subarray(3))).toEqual(track);
    });
  });

  describe("error paths", () => {
    it("returns null for a truncated buffer", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const bytes = encodePitchTrack(sliceTrack());
      for (const cut of [1, 2, 7, 14, bytes.length - 10, bytes.length]) {
        expect(decodePitchTrack(bytes.subarray(0, bytes.length - cut))).toBeNull();
      }
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });
});
