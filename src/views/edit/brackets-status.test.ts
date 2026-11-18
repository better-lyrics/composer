/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { bracketsStatus } from "@/views/edit/brackets-status";

describe("bracketsStatus", () => {
  it("regression: says brackets are kept as text instead of none left when extraction cannot take them", () => {
    expect(bracketsStatus(0, 5)).toBe("5 lines keep ( ) as text");
    expect(bracketsStatus(2, 5)).toBe("2 lines still have ( )");
    expect(bracketsStatus(0, 0)).toBe("No ( ) left in the lyrics");
  });
});
