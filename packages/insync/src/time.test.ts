import { describe, expect, it } from "vitest";
import { msFromSeconds, secondsFromMs } from "./time";

describe("time", () => {
  it("rounds seconds to ms exactly as export does", () => {
    for (const seconds of [0, 12.4, 12.62, 1.0005, 59.9995, 243.12345]) {
      expect(msFromSeconds(seconds)).toBe(Math.round(seconds * 1000));
    }
  });

  it("converts ms back to the seconds the app stores", () => {
    expect(secondsFromMs(msFromSeconds(12.62))).toBe(12.62);
  });
});
