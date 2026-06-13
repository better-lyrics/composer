import { describe, expect, it } from "vitest";
import { WaveformFallback } from "@/ui/library/waveform-fallback";
import { render } from "@/test/render";
import { hashTint, TINT_BG } from "@/utils/library/hash-tint";

// -- Helpers ------------------------------------------------------------------

function findSvg(container: HTMLElement): SVGElement {
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("svg not found");
  return svg as SVGElement;
}

// -- Tests --------------------------------------------------------------------

describe("WaveformFallback", () => {
  it("renders an svg with the deterministic tint background", async () => {
    const seed = "project-42";
    const expectedBg = TINT_BG[hashTint(seed)];

    const screen = await render(<WaveformFallback seed={seed} />);
    const svg = findSvg(screen.container);
    const rect = svg.querySelector("rect");
    expect(rect).not.toBeNull();
    expect(rect?.getAttribute("fill")).toBe(expectedBg);

    const screenTwo = await render(<WaveformFallback seed={seed} />);
    const rectTwo = findSvg(screenTwo.container).querySelector("rect");
    expect(rectTwo?.getAttribute("fill")).toBe(expectedBg);
  });

  it("uses provided peaks when present", async () => {
    const peaks = [1, 1, 1, 1];
    const screen = await render(<WaveformFallback seed="seed-with-peaks" peaks={peaks} />);
    const path = findSvg(screen.container).querySelector("path");
    expect(path).not.toBeNull();
    expect(path?.getAttribute("d")?.length).toBeGreaterThan(0);
  });

  it("falls back to synthesized peaks when peaks prop is omitted", async () => {
    const a = await render(<WaveformFallback seed="seed-synth" />);
    const b = await render(<WaveformFallback seed="seed-synth" />);
    const da = findSvg(a.container).querySelector("path")?.getAttribute("d");
    const db = findSvg(b.container).querySelector("path")?.getAttribute("d");
    expect(da).toBeTruthy();
    expect(da).toBe(db);
  });

  it("accepts a className that applies to the root element", async () => {
    const screen = await render(<WaveformFallback seed="x" className="rounded-xl custom-class" />);
    const svg = findSvg(screen.container);
    expect(svg.classList.contains("rounded-xl")).toBe(true);
    expect(svg.classList.contains("custom-class")).toBe(true);
  });

  describe("edge cases", () => {
    it("renders when peaks is an empty array (falls back to synth)", async () => {
      const screen = await render(<WaveformFallback seed="empty-peaks" peaks={[]} />);
      const path = findSvg(screen.container).querySelector("path");
      expect(path?.getAttribute("d")?.length).toBeGreaterThan(0);
    });

    it("renders different paths for different seeds", async () => {
      const a = await render(<WaveformFallback seed="alpha" />);
      const b = await render(<WaveformFallback seed="bravo" />);
      const da = findSvg(a.container).querySelector("path")?.getAttribute("d");
      const db = findSvg(b.container).querySelector("path")?.getAttribute("d");
      expect(da).not.toBe(db);
    });
  });
});
