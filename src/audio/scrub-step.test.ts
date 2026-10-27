import { describe, expect, it } from "vitest";
import { SCRUB_JUMP_S, furthestTimeAfter, scrubStep } from "@/audio/scrub-step";

const voice = 10;

describe("scrubStep", () => {
  it("starts a voice when none is playing", () => {
    expect(scrubStep(null, 10.02, 10, 1)).toEqual({ kind: "start", rate: 1 });
  });

  it("steers the running voice for a small forward move", () => {
    const step = scrubStep(voice, 10.05, 10, 1);
    expect(step.kind).toBe("steer");
    if (step.kind === "steer") expect(step.rate).toBeGreaterThan(1);
  });

  it("slows the voice when it has run ahead of the playhead", () => {
    const step = scrubStep(10.1, 10.05, 10, 1);
    expect(step.kind === "steer" && step.rate < 1).toBe(true);
  });

  it("follows a crawl below a quarter speed", () => {
    const step = scrubStep(10.01, 10.01, 10, 0.08);
    expect(step).toEqual({ kind: "steer", rate: 0.08 });
  });

  it("jumps on a move larger than the jump threshold", () => {
    expect(scrubStep(voice, 10 + SCRUB_JUMP_S + 0.01, 10, 1)).toEqual({ kind: "start", rate: 1 });
  });

  it("plays a clip when the playhead moves backward", () => {
    expect(scrubStep(voice, 9.95, 10, 1)).toEqual({ kind: "clip" });
  });

  describe("edge cases", () => {
    it("regression: treats a sub-millisecond step back as jitter, not a reversal", () => {
      expect(scrubStep(voice, 9.9995, 10, 1).kind).toBe("steer");
    });

    it("regression: steady slow backward movement becomes a reversal once it adds up", () => {
      let furthest = 10;
      const kinds = [9.999, 9.998, 9.997].map((time) => {
        const step = scrubStep(voice, time, furthest, 0.12);
        furthest = furthestTimeAfter(step, furthest, time);
        return step.kind;
      });
      expect(kinds).toEqual(["steer", "steer", "clip"]);
    });

    it("keeps the rate inside 0.05x to 4x", () => {
      const fast = scrubStep(voice, 10.14, 10, 4);
      const slow = scrubStep(10.01, 10.01, 10, 0.02);
      expect(fast).toEqual({ kind: "steer", rate: 4 });
      expect(slow).toEqual({ kind: "steer", rate: 0.05 });
    });

    it("starts at the clamped speed", () => {
      expect(scrubStep(null, 10.02, 10, 9)).toEqual({ kind: "start", rate: 4 });
      expect(scrubStep(null, 10.02, 10, 0.01)).toEqual({ kind: "start", rate: 0.05 });
    });

    it("restarts when the voice ran further ahead than slowing down can recover", () => {
      expect(scrubStep(10.086, 10.02, 10.01, 0.08)).toEqual({ kind: "start", rate: 0.08 });
    });

    it("treats an unchanged playhead as a steer, not a jump", () => {
      expect(scrubStep(voice, 10, 10, 1).kind).toBe("steer");
    });

    it("jumps when the voice has run far ahead of a slow playhead", () => {
      expect(scrubStep(10.3, 10.01, 10, 0.1)).toEqual({ kind: "start", rate: 0.1 });
    });
  });
});
