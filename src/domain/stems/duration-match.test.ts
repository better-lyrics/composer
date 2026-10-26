import { stemDurationMismatch } from "@/domain/stems/duration-match";
import { describe, expect, it } from "vitest";

describe("stemDurationMismatch", () => {
  it("regression: accepts a stem exactly 50 ms off, which floating point reads as just over", () => {
    expect(stemDurationMismatch(192.35, 192.4)).toBeNull();
  });
});
