import { usePageVisible } from "@/hooks/use-page-visible";
import { overrideVisibilityState } from "@/test/visibility";
import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";

describe("usePageVisible", () => {
  it("reports a visible test page", async () => {
    const { result } = await renderHook(() => usePageVisible());
    expect(result.current).toBe(document.visibilityState === "visible");
  });

  describe("invariants", () => {
    it("keeps its value across renders when nothing changed", async () => {
      const { result, rerender } = await renderHook(() => usePageVisible());
      const first = result.current;
      await rerender();
      expect(result.current).toBe(first);
    });
  });

  describe("regressions", () => {
    it("regression: reacts to a real visibilitychange event", async () => {
      const { result } = await renderHook(() => usePageVisible());
      const initial = result.current;
      const restore = overrideVisibilityState(initial ? "hidden" : "visible");
      try {
        document.dispatchEvent(new Event("visibilitychange"));
        await expect.poll(() => result.current).toBe(!initial);
      } finally {
        restore();
      }
    });
  });
});
