import { stretchedBaseRect } from "@/domain/spectrum/zoom-stretch";
import { describe, expect, it } from "vitest";

describe("stretchedBaseRect", () => {
  it("draws every time point where the new zoom puts it", () => {
    const base = { pixelsPerSecond: 100, scrollLeft: 2400, widthCss: 1200 };
    const target = { pixelsPerSecond: 160, scrollLeft: 3900 };
    const rect = stretchedBaseRect(base, target);
    for (const time of [24, 30.5, 35.99]) {
      const baseX = time * base.pixelsPerSecond - base.scrollLeft;
      const drawnX = rect.x + baseX * (rect.width / base.widthCss);
      expect(drawnX).toBeCloseTo(time * target.pixelsPerSecond - target.scrollLeft, 9);
    }
  });
});
