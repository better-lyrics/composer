import { resolveAnalysis } from "@/domain/spectrum/analysis-window";
import { describe, expect, it } from "vitest";

describe("resolveAnalysis", () => {
  it("analyses vocals at 1024 and the mix at 2048 on Auto", () => {
    expect(resolveAnalysis("vocals", "auto", true)).toEqual({ source: "vocals", fftSize: 1024, hop: 256 });
    expect(resolveAnalysis("mix", "auto", true)).toEqual({ source: "mix", fftSize: 2048, hop: 512 });
  });

  it("falls back to the mix when there is no vocal stem", () => {
    expect(resolveAnalysis("vocals", "auto", false)).toEqual({ source: "mix", fftSize: 2048, hop: 512 });
  });

  it("honours a fixed window on either source", () => {
    expect(resolveAnalysis("vocals", "2048", true)).toEqual({ source: "vocals", fftSize: 2048, hop: 512 });
  });
});
