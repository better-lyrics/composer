import { stripTrailingSlashes } from "@/utils/url";
import { describe, expect, it } from "vitest";

describe("stripTrailingSlashes", () => {
  it("removes a single trailing slash", () => {
    expect(stripTrailingSlashes("https://cobalt.boidu.dev/")).toBe("https://cobalt.boidu.dev");
  });

  it("removes multiple trailing slashes", () => {
    expect(stripTrailingSlashes("https://cobalt.boidu.dev///")).toBe("https://cobalt.boidu.dev");
  });

  describe("edge cases", () => {
    it("leaves a value with no trailing slash alone", () => {
      expect(stripTrailingSlashes("/editor")).toBe("/editor");
    });

    it("leaves an internal slash alone", () => {
      expect(stripTrailingSlashes("/guides/lrc-to-ttml")).toBe("/guides/lrc-to-ttml");
    });

    it("returns an empty string for an empty input", () => {
      expect(stripTrailingSlashes("")).toBe("");
    });

    it("reduces a string of only slashes to empty", () => {
      expect(stripTrailingSlashes("///")).toBe("");
    });
  });
});
