import {
  HEAT_STOPS,
  PHASE_STOPS,
  type PaletteLookup,
  type PaletteStop,
  type Rgb,
  paletteLookup,
} from "@/domain/spectrum/palettes";
import type { SpectrumPalette } from "@/domain/spectrum/settings";
import { useThemeStore } from "@/stores/theme";

// -- Interfaces ----------------------------------------------------------------

interface ResolvedPalette {
  lookup: PaletteLookup;
  themeGeneration: number;
}

interface ThemeSnapshot {
  themeId: string;
  customThemes: readonly unknown[];
}

// -- Constants -----------------------------------------------------------------

const FIXED_LOOKUPS: Record<Exclude<SpectrumPalette, "theme">, PaletteLookup> = {
  heat: paletteLookup(HEAT_STOPS),
  phase: paletteLookup(PHASE_STOPS),
};

// -- State ---------------------------------------------------------------------

let themeGeneration = 0;
let themeLookup: PaletteLookup | null = null;
let resolvedFor: ThemeSnapshot | null = null;
let parseContext: OffscreenCanvasRenderingContext2D | null = null;

// -- Functions -----------------------------------------------------------------

function cssVariable(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function rgbOf(css: string): Rgb {
  parseContext ??= new OffscreenCanvas(1, 1).getContext("2d", { willReadFrequently: true });
  if (!parseContext) return [0, 0, 0];
  parseContext.clearRect(0, 0, 1, 1);
  parseContext.fillStyle = "#000";
  parseContext.fillStyle = css;
  parseContext.fillRect(0, 0, 1, 1);
  const [r, g, b] = parseContext.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

function themeStops(): PaletteStop[] {
  const dark = cssVariable("--color-composer-bg-dark");
  const accent = cssVariable("--color-composer-accent");
  const accentText = cssVariable("--color-composer-accent-text");
  return [
    [0, rgbOf(`color-mix(in oklab, ${dark} 55%, black)`)],
    [0.35, rgbOf(`color-mix(in oklab, ${accent} 40%, ${dark})`)],
    [0.7, rgbOf(accent)],
    [0.88, rgbOf(accentText)],
    [1, [255, 255, 255]],
  ];
}

// The theme palette follows the app theme, so it is re-read whenever the theme store changes.
function resolveSpectrumPalette(palette: SpectrumPalette): ResolvedPalette {
  if (palette !== "theme") return { lookup: FIXED_LOOKUPS[palette], themeGeneration };
  const { activeThemeId, customThemes } = useThemeStore.getState();
  if (!themeLookup || resolvedFor?.themeId !== activeThemeId || resolvedFor.customThemes !== customThemes) {
    resolvedFor = { themeId: activeThemeId, customThemes };
    themeLookup = paletteLookup(themeStops());
    themeGeneration++;
  }
  return { lookup: themeLookup, themeGeneration };
}

// -- Exports -------------------------------------------------------------------

export { resolveSpectrumPalette };
export type { ResolvedPalette };
