import {
  HEAT_STOPS,
  PHASE_STOPS,
  type PaletteLookup,
  type PaletteStop,
  paletteLookup,
} from "@/domain/spectrum/palettes";
import type { SpectrumPalette } from "@/domain/spectrum/settings";
import { useThemeStore } from "@/stores/theme";
import { cssVariable, rgbOf } from "@/utils/theme/css-colour";

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

// -- Functions -----------------------------------------------------------------

function themeStops(): PaletteStop[] {
  const accent = cssVariable("--color-composer-accent");
  // Built from the accent alone, like Heat it stays dark-based in light themes too, so it is always monotonic.
  const floor = `color-mix(in oklab, ${accent} 12%, black)`;
  return [
    [0, rgbOf(`color-mix(in oklab, ${accent} 6%, black)`)],
    [0.35, rgbOf(`color-mix(in oklab, ${accent} 45%, ${floor})`)],
    [0.7, rgbOf(accent)],
    [0.88, rgbOf(`color-mix(in oklab, ${accent} 50%, white)`)],
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
