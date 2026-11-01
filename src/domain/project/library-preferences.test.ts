import { isLaunchScreen, isLibraryView } from "@/domain/project/library-preferences";
import { describe, expect, it } from "vitest";

describe("isLibraryView", () => {
  it("accepts the list and grid views", () => {
    expect(isLibraryView("list")).toBe(true);
    expect(isLibraryView("grid")).toBe(true);
  });

  describe("error paths", () => {
    it("rejects anything else", () => {
      for (const value of ["Grid", "", "table", undefined, null, 1]) expect(isLibraryView(value)).toBe(false);
    });
  });
});

describe("isLaunchScreen", () => {
  it("accepts the projects home and the last project", () => {
    expect(isLaunchScreen("projects")).toBe(true);
    expect(isLaunchScreen("last-project")).toBe(true);
  });

  describe("error paths", () => {
    it("rejects anything else", () => {
      for (const value of ["editor", "Projects", undefined, {}]) expect(isLaunchScreen(value)).toBe(false);
    });
  });
});
