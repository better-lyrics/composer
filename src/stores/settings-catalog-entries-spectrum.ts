import type { SettingEntry } from "@/stores/settings-catalog";

// -- Catalog ------------------------------------------------------------------

const SPECTRUM_CATALOG_ENTRIES = {
  showSpectrum: {
    section: "spectrum",
    label: "Show spectrum",
    description: "Show the spectrum in place of the waveform.",
    keywords: ["spectrogram", "frequency", "waveform"],
    settingKey: "showSpectrum",
  },
  pitchLine: {
    section: "spectrum",
    label: "Pitch line",
    description: "Draw the sung melody inside word blocks once vocals are separated.",
    keywords: ["pitch", "melody", "notes", "f0", "contour"],
    settingKey: "pitchLine",
  },
  spectrumSource: {
    section: "spectrum",
    group: "Look",
    label: "Listen to",
    description: "Draw the vocal stem when there is one, or the full mix.",
    keywords: ["spectrogram", "vocals", "mix", "stem"],
    settingKey: "spectrumSource",
  },
  spectrumPalette: {
    section: "spectrum",
    group: "Look",
    label: "Colours",
    description: "Heat for loudness, Theme to match your colours, Phase to show where notes bend.",
    keywords: ["spectrogram", "palette", "color", "colour", "heat", "phase"],
    settingKey: "spectrumPalette",
  },
  spectrumPhase: {
    section: "spectrum",
    group: "Look",
    label: "Phase colours",
    description: "Bends shows where a sung note changes, like a vowel or vibrato. Raw shows the phase itself.",
    keywords: ["spectrogram", "phase", "vibrato"],
    settingKey: "spectrumPhase",
    visibleWhen: (state) => state.spectrumPalette === "phase",
  },
  spectrumContrast: {
    section: "spectrum",
    group: "Look",
    label: "Contrast",
    description: "Lower shows quieter detail, higher hides background noise.",
    keywords: ["spectrogram", "floor", "noise", "brightness"],
    settingKey: "spectrumContrast",
  },
  spectrumScale: {
    section: "spectrum",
    group: "Look",
    label: "Frequency scale",
    description: "Mel gives the voice range the most room. Linear spaces every frequency evenly.",
    keywords: ["spectrogram", "mel", "log", "linear"],
    settingKey: "spectrumScale",
  },
  spectrumTop: {
    section: "spectrum",
    group: "Look",
    label: "Top frequency",
    description: "8 kHz zooms in on the voice. 18 kHz shows cymbals and breaths too.",
    keywords: ["spectrogram", "range", "khz"],
    settingKey: "spectrumTop",
  },
  spectrumWindow: {
    section: "spectrum",
    group: "Analysis",
    label: "Analysis window",
    description: "Auto uses 1024 for vocals and 2048 for the mix. Smaller is sharper in time, larger in pitch.",
    keywords: ["spectrogram", "fft", "resolution"],
    settingKey: "spectrumWindow",
  },
  loupeSize: {
    section: "spectrum",
    group: "Analysis",
    label: "Loupe size",
    description: "The close-up that opens while you drag a word edge. Taller helps most at 18 kHz.",
    keywords: ["loupe", "magnifier", "zoom", "size", "width", "height", "spectrogram"],
  },
} as const satisfies Record<string, SettingEntry>;

// -- Exports ------------------------------------------------------------------

export { SPECTRUM_CATALOG_ENTRIES };
