import { isStorageLimit, storageLimitBytes } from "@/domain/storage/storage-limit";
import { describe, expect, it } from "vitest";

const GIBIBYTE = 1024 ** 3;

describe("storageLimitBytes", () => {
  it("turns each limit into binary gigabytes", () => {
    expect(storageLimitBytes("1gb")).toBe(GIBIBYTE);
    expect(storageLimitBytes("2gb")).toBe(2 * GIBIBYTE);
    expect(storageLimitBytes("5gb")).toBe(5 * GIBIBYTE);
  });

  it("has no byte limit for No limit", () => {
    expect(storageLimitBytes("none")).toBeUndefined();
  });
});

describe("isStorageLimit", () => {
  it("accepts the four limits", () => {
    for (const limit of ["1gb", "2gb", "5gb", "none"]) expect(isStorageLimit(limit)).toBe(true);
  });

  describe("edge cases", () => {
    it("rejects other sizes and non-strings", () => {
      for (const value of ["10gb", "1GB", "2 GB", "", null, undefined, 2, {}])
        expect(isStorageLimit(value)).toBe(false);
    });
  });
});
