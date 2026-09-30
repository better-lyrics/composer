import { BROWSER_KIND } from "@/utils/platform";
import { describe, expect, it } from "vitest";

describe("BROWSER_KIND", () => {
  it("is chromium in this project's real browser tests (Chromium)", () => {
    expect(BROWSER_KIND).toBe("chromium");
  });
});
