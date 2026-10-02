import { EDITOR_PATH, LIBRARY_PATH, screenForPath } from "@/utils/app-routes";
import { describe, expect, it } from "vitest";

describe("screenForPath", () => {
  it("shows the library at the root and the editor at /editor", () => {
    expect(screenForPath(LIBRARY_PATH)).toBe("library");
    expect(screenForPath(EDITOR_PATH)).toBe("editor");
  });

  describe("edge cases", () => {
    it("accepts a trailing slash on the editor path", () => {
      expect(screenForPath("/editor/")).toBe("editor");
    });

    it("treats any other path as the library", () => {
      expect(screenForPath("")).toBe("library");
      expect(screenForPath("/editors")).toBe("library");
    });
  });
});
