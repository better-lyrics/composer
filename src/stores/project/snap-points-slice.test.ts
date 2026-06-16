import { useProjectStore } from "@/stores/project";
import { beforeEach, describe, expect, it } from "vitest";

describe("project snap points: setCustomSnapPoints", () => {
  beforeEach(() => useProjectStore.setState({ customSnapPoints: [] }));

  it("filters non-finite and negative values and sorts ascending", () => {
    useProjectStore.getState().setCustomSnapPoints([3, 1, -2, Number.NaN, Number.POSITIVE_INFINITY]);
    expect(useProjectStore.getState().customSnapPoints).toEqual([1, 3]);
  });

  it("keeps zero and allows duplicates", () => {
    useProjectStore.getState().setCustomSnapPoints([2, 0, 2]);
    expect(useProjectStore.getState().customSnapPoints).toEqual([0, 2, 2]);
  });
});
