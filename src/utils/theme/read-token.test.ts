import { afterEach, describe, expect, it } from "vitest";
import { TOKEN_VAR } from "@/domain/theme/model";
import { readToken } from "@/utils/theme/read-token";

afterEach(() => {
  for (const varName of Object.values(TOKEN_VAR)) {
    document.documentElement.style.removeProperty(varName);
  }
});

describe("readToken", () => {
  it("returns the computed value of a token's CSS variable from documentElement", () => {
    document.documentElement.style.setProperty("--color-composer-accent", "#123456");
    expect(readToken("accent")).toBe("#123456");
  });

  it("reads a different token independently", () => {
    document.documentElement.style.setProperty("--color-composer-wave", "#737476");
    expect(readToken("wave")).toBe("#737476");
  });

  it("resolves the var name from TOKEN_VAR for each key", () => {
    document.documentElement.style.setProperty(TOKEN_VAR.snap, "#ffd66b");
    expect(readToken("snap")).toBe("#ffd66b");
  });

  describe("edge cases", () => {
    it("trims surrounding whitespace from the computed value", () => {
      document.documentElement.style.setProperty("--color-composer-accent", "  rgb(1, 2, 3)  ");
      expect(readToken("accent")).toBe("rgb(1, 2, 3)");
    });

    it("returns an empty string for an unset token", () => {
      expect(readToken("wave-progress")).toBe("");
    });
  });
});
