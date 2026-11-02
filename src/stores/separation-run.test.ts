import { fallbackModel, runnableModel } from "@/stores/separation-run";
import { describe, expect, it } from "vitest";

describe("separation fallback", () => {
  it("separates with HTDemucs after a RoFormer run fails, and only then", () => {
    expect(fallbackModel("roformer", "error", false)).toBe("fp16");
    expect(fallbackModel("roformer", "idle", false)).toBeNull();
    expect(fallbackModel("roformer", "error", true)).toBeNull();
    expect(fallbackModel("fp16", "error", false)).toBeNull();
    expect(fallbackModel("fp32", "error", false)).toBeNull();
  });

  it("runs HTDemucs when the RoFormer is picked on a browser without WebGPU, and leaves other picks alone", async () => {
    expect(await runnableModel("roformer")).toBe("fp16");
    expect(await runnableModel("fp32")).toBe("fp32");
  });
});
