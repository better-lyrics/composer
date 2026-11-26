import { describe, expect, it } from "vitest";
import { isEmptyDocPassthrough, isEmptyPassthrough, type KeptTimes, keptTimes } from "./passthrough";

describe("keptTimes", () => {
  it("kept times hold only while the envelope is unchanged", () => {
    const kept: KeptTimes = { begin: "00:12.100", end: "00:20.000", envelope: ["00:12.400", "00:19.800"] };
    expect(keptTimes(kept, ["00:12.400", "00:19.800"])).toEqual(["00:12.100", "00:20.000"]);
    expect(keptTimes(kept, ["00:12.500", "00:19.800"])).toBeNull();
  });
});

describe("isEmptyPassthrough", () => {
  it("counts a node or document that keeps nothing as empty, at any depth", () => {
    expect(isEmptyPassthrough({ attrs: [], elements: [] })).toBe(true);
    expect(isEmptyDocPassthrough({})).toBe(true);
    expect(isEmptyDocPassthrough({ tt: {}, head: { attrs: [] } })).toBe(true);
    expect(isEmptyPassthrough({ attrs: [["x-vendor:cue", "3"]] })).toBe(false);
    expect(isEmptyDocPassthrough({ body: { times: { begin: "1.0", end: "2.0", envelope: ["1.0", "2.0"] } } })).toBe(
      false,
    );
  });
});
