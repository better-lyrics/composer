import { describe, expect, it } from "vitest";
import { type KeptTimes, keptTimes } from "./passthrough";

describe("keptTimes", () => {
  it("kept times hold only while the envelope is unchanged", () => {
    const kept: KeptTimes = { begin: "00:12.100", end: "00:20.000", envelope: ["00:12.400", "00:19.800"] };
    expect(keptTimes(kept, ["00:12.400", "00:19.800"])).toEqual(["00:12.100", "00:20.000"]);
    expect(keptTimes(kept, ["00:12.500", "00:19.800"])).toBeNull();
  });
});
