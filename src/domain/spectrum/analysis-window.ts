import type { AnalysisWindow, SpectrumSource } from "@/domain/spectrum/settings";

// -- Types --------------------------------------------------------------------

interface ResolvedAnalysis {
  source: SpectrumSource;
  fftSize: number;
  hop: number;
}

// -- Functions ----------------------------------------------------------------

// Vocals need time detail for syllable edges; a full mix needs the finer bins to separate parts.
function resolveAnalysis(preference: SpectrumSource, window: AnalysisWindow, hasVocals: boolean): ResolvedAnalysis {
  const source: SpectrumSource = preference === "vocals" && hasVocals ? "vocals" : "mix";
  const fftSize = window === "auto" ? (source === "vocals" ? 1024 : 2048) : Number(window);
  return { source, fftSize, hop: fftSize / 4 };
}

// -- Exports ------------------------------------------------------------------

export { resolveAnalysis };
export type { ResolvedAnalysis };
