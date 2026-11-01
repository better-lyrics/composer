import type { FrequencyScale, PhaseColours, SpectrumPalette, SpectrumTop } from "@/domain/spectrum/settings";

// -- Types --------------------------------------------------------------------

interface TileInputs {
  analysisGeneration: number;
  pixelsPerSecond: number;
  height: number;
  scale: FrequencyScale;
  top: SpectrumTop;
  palette: SpectrumPalette;
  phase: PhaseColours;
  contrastDb: number;
  themeGeneration: number;
  index: number;
}

// -- Constants ----------------------------------------------------------------

const TILE_WIDTH = 256;

// -- Functions ----------------------------------------------------------------

function tileKey(inputs: TileInputs): string {
  return [
    inputs.analysisGeneration,
    inputs.pixelsPerSecond,
    inputs.height,
    inputs.scale,
    inputs.top,
    inputs.palette,
    inputs.phase,
    inputs.contrastDb,
    inputs.themeGeneration,
    inputs.index,
  ].join("|");
}

function visibleTileRange(scrollLeft: number, viewportWidth: number): { first: number; last: number } {
  const left = Math.max(0, scrollLeft);
  return { first: Math.floor(left / TILE_WIDTH), last: Math.floor((left + viewportWidth) / TILE_WIDTH) };
}

// -- Exports ------------------------------------------------------------------

export { TILE_WIDTH, tileKey, visibleTileRange };
export type { TileInputs };
