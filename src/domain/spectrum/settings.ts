// -- Types --------------------------------------------------------------------

type SpectrumSource = "vocals" | "mix";
type SpectrumPalette = "heat" | "theme" | "phase";
type FrequencyScale = "mel" | "log" | "linear";
type SpectrumTop = "full" | "voice";
type AnalysisWindow = "auto" | "1024" | "2048";
type PhaseColours = "change" | "raw";

interface SpectrumLook {
  spectrumSource: SpectrumSource;
  spectrumPalette: SpectrumPalette;
  spectrumContrast: number;
  spectrumScale: FrequencyScale;
  spectrumTop: SpectrumTop;
  spectrumWindow: AnalysisWindow;
  spectrumPhase: PhaseColours;
}

interface SpectrumSettings extends SpectrumLook {
  showSpectrum: boolean;
  spectrumBandHeight: number;
}

// -- Constants ----------------------------------------------------------------

const SPECTRUM_BAND_HEIGHT = { min: 80, default: 168, max: 320 } as const;
const SPECTRUM_CONTRAST = { min: -100, default: -72, max: -40 } as const;

const LOOK_VALUES = {
  spectrumSource: ["vocals", "mix"],
  spectrumPalette: ["heat", "theme", "phase"],
  spectrumScale: ["mel", "log", "linear"],
  spectrumTop: ["full", "voice"],
  spectrumWindow: ["auto", "1024", "2048"],
  spectrumPhase: ["change", "raw"],
} as const;

const SPECTRUM_LOOK_DEFAULTS: SpectrumLook = {
  spectrumSource: "vocals",
  spectrumPalette: "heat",
  spectrumContrast: SPECTRUM_CONTRAST.default,
  spectrumScale: "mel",
  spectrumTop: "full",
  spectrumWindow: "auto",
  spectrumPhase: "change",
};

const SPECTRUM_SETTING_DEFAULTS: SpectrumSettings = {
  showSpectrum: false,
  spectrumBandHeight: SPECTRUM_BAND_HEIGHT.default,
  ...SPECTRUM_LOOK_DEFAULTS,
};

// -- Functions ----------------------------------------------------------------

function spectrumLookDefaults(): SpectrumLook {
  return { ...SPECTRUM_LOOK_DEFAULTS };
}

function isDefaultSpectrumLook(look: SpectrumLook): boolean {
  return (Object.keys(SPECTRUM_LOOK_DEFAULTS) as (keyof SpectrumLook)[]).every(
    (key) => look[key] === SPECTRUM_LOOK_DEFAULTS[key],
  );
}

function clampSpectrumBandHeight(px: number): number {
  if (!Number.isFinite(px)) return SPECTRUM_BAND_HEIGHT.default;
  return Math.round(Math.min(SPECTRUM_BAND_HEIGHT.max, Math.max(SPECTRUM_BAND_HEIGHT.min, px)));
}

function clampSpectrumContrast(db: number): number {
  if (!Number.isFinite(db)) return SPECTRUM_CONTRAST.default;
  return Math.round(Math.min(SPECTRUM_CONTRAST.max, Math.max(SPECTRUM_CONTRAST.min, db)));
}

function sanitizeSpectrumSettings(persisted: Readonly<Record<string, unknown>>): Partial<SpectrumSettings> {
  const valid: Partial<SpectrumSettings> = {};
  for (const [key, allowed] of Object.entries(LOOK_VALUES)) {
    const value = persisted[key];
    if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
      Object.assign(valid, { [key]: value });
    }
  }
  if (typeof persisted.spectrumContrast === "number")
    valid.spectrumContrast = clampSpectrumContrast(persisted.spectrumContrast);
  if (typeof persisted.spectrumBandHeight === "number")
    valid.spectrumBandHeight = clampSpectrumBandHeight(persisted.spectrumBandHeight);
  if (typeof persisted.showSpectrum === "boolean") valid.showSpectrum = persisted.showSpectrum;
  return valid;
}

// -- Exports ------------------------------------------------------------------

export {
  SPECTRUM_BAND_HEIGHT,
  SPECTRUM_CONTRAST,
  SPECTRUM_SETTING_DEFAULTS,
  clampSpectrumBandHeight,
  clampSpectrumContrast,
  isDefaultSpectrumLook,
  sanitizeSpectrumSettings,
  spectrumLookDefaults,
};
export type {
  AnalysisWindow,
  FrequencyScale,
  PhaseColours,
  SpectrumLook,
  SpectrumPalette,
  SpectrumSettings,
  SpectrumSource,
  SpectrumTop,
};
