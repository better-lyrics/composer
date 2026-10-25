import { stemDurationMismatch } from "@/domain/stems/duration-match";
import { describe, expect, it } from "vitest";

describe("stemDurationMismatch", () => {
  it("accepts a stem within 50 ms of the song", () => {
    expect(stemDurationMismatch(192.43, 192.4)).toBeNull();
    expect(stemDurationMismatch(192.35, 192.4)).toBeNull();
  });

  it("returns the signed difference past the tolerance", () => {
    expect(stemDurationMismatch(193.6, 192.4)).toBeCloseTo(1.2);
    expect(stemDurationMismatch(191.4, 192.4)).toBeCloseTo(-1);
  });

  it("accepts any stem while the song duration is unknown", () => {
    expect(stemDurationMismatch(12, 0)).toBeNull();
  });
});
