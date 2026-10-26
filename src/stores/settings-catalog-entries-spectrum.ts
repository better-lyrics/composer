import type { SettingEntry } from "@/stores/settings-catalog";

// -- Catalog ------------------------------------------------------------------

const SPECTRUM_CATALOG_ENTRIES = {
  pitchLine: {
    section: "timeline",
    label: "Pitch line",
    description: "Draw the sung melody inside word blocks once vocals are separated.",
    keywords: ["pitch", "melody", "notes", "f0", "contour"],
    settingKey: "pitchLine",
  },
  showSpectrum: {
    section: "timeline",
    label: "Show spectrum",
    description: "Show the spectrum in place of the waveform.",
    keywords: ["spectrogram", "frequency", "waveform"],
    settingKey: "showSpectrum",
  },
  spectrumSource: {
    section: "timeline",
    label: "Listen to",
    description: "Draw the vocal stem when there is one, or the full mix.",
    keywords: ["spectrogram", "vocals", "mix", "stem"],
    settingKey: "spectrumSource",
    group: "Spectrum",
  },
  spectrumPalette: {
    section: "timeline",
    label: "Colours",
    description: "Heat for loudness, Theme to match your colours, Phase to show where notes bend.",
    keywords: ["spectrogram", "palette", "color", "colour", "heat", "phase"],
    settingKey: "spectrumPalette",
    group: "Spectrum",
  },
  spectrumContrast: {
    section: "timeline",
    label: "Contrast",
    description: "Lower shows quieter detail, higher hides background noise.",
    keywords: ["spectrogram", "floor", "noise", "brightness"],
    settingKey: "spectrumContrast",
    group: "Spectrum",
  },
  spectrumScale: {
    section: "timeline",
    label: "Frequency scale",
    description: "Mel gives the voice range the most room. Linear spaces every frequency evenly.",
    keywords: ["spectrogram", "mel", "log", "linear"],
    settingKey: "spectrumScale",
    group: "Spectrum",
  },
  spectrumTop: {
    section: "timeline",
    label: "Top frequency",
    description: "8 kHz zooms in on the voice. 18 kHz shows cymbals and breaths too.",
    keywords: ["spectrogram", "range", "khz"],
    settingKey: "spectrumTop",
    group: "Spectrum",
  },
  spectrumWindow: {
    section: "timeline",
    label: "Analysis window",
    description: "Auto uses 1024 for vocals and 2048 for the mix. Smaller is sharper in time, larger in pitch.",
    keywords: ["spectrogram", "fft", "resolution"],
    settingKey: "spectrumWindow",
    group: "Spectrum",
  },
  spectrumPhase: {
    section: "timeline",
    label: "Phase colours",
    description: "Bends shows where a sung note changes, like a vowel or vibrato. Raw shows the phase itself.",
    keywords: ["spectrogram", "phase", "vibrato"],
    settingKey: "spectrumPhase",
    group: "Spectrum",
    visibleWhen: (state) => state.spectrumPalette === "phase",
  },
} as const satisfies Record<string, SettingEntry>;

// -- Exports ------------------------------------------------------------------

export { SPECTRUM_CATALOG_ENTRIES };
