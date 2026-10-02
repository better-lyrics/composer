import { soloPlayStart, soloPlaybackEnd } from "@/views/timeline/solo-playback";
import { describe, expect, it } from "vitest";

const chorus = { begin: 40, end: 48 };

describe("soloPlayStart", () => {
  it("starts at the instance start when play begins before it", () => {
    expect(soloPlayStart(12, chorus)).toBe(40);
  });

  it("starts at the instance start when play begins after it", () => {
    expect(soloPlayStart(60, chorus)).toBe(40);
  });

  it("keeps the playhead when play begins inside the instance", () => {
    expect(soloPlayStart(44, chorus)).toBeNull();
  });

  describe("edge cases", () => {
    it("keeps the playhead exactly on the start", () => {
      expect(soloPlayStart(40, chorus)).toBeNull();
    });

    it("restarts from the start when the playhead sits on the end", () => {
      expect(soloPlayStart(48, chorus)).toBe(40);
    });
  });
});

describe("soloPlaybackEnd", () => {
  it("does nothing before the end", () => {
    expect(soloPlaybackEnd(47.5, chorus, false)).toBeNull();
  });

  it("stops and returns to the start at the end", () => {
    expect(soloPlaybackEnd(48.1, chorus, false)).toEqual({ seekTo: 40, pause: true });
  });

  it("returns to the start and keeps playing when looping", () => {
    expect(soloPlaybackEnd(48, chorus, true)).toEqual({ seekTo: 40, pause: false });
  });

  describe("edge cases", () => {
    it("treats a time a hair before the end as the end", () => {
      expect(soloPlaybackEnd(47.998, chorus, false)).toEqual({ seekTo: 40, pause: true });
    });
  });
});
