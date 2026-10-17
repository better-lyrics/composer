import { routes } from "@/router";
import { describe, expect, it } from "vitest";

describe("routes", () => {
  it("nests the library and the editor under one layout so the shell never remounts", () => {
    const home = routes.find((route) => route.path === "/");
    expect(home?.children?.map((child) => (child.index ? "index" : child.path))).toEqual(["index", "editor"]);
  });

  describe("invariants", () => {
    it("keeps /editor out of the top level so it cannot mount a second shell", () => {
      expect(routes.some((route) => route.path === "/editor")).toBe(false);
    });
  });
});
