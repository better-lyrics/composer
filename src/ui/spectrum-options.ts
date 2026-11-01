import type { PitchLineMode } from "@/domain/pitch/pitch-line-mode";
import type {
  AnalysisWindow,
  FrequencyScale,
  PhaseColours,
  SpectrumPalette,
  SpectrumSource,
  SpectrumTop,
} from "@/domain/spectrum/settings";

// -- Types ---------------------------------------------------------------------

interface Option<Value extends string> {
  value: Value;
  label: string;
}

// -- Options -------------------------------------------------------------------

const SPECTRUM_SOURCE_OPTIONS: readonly Option<SpectrumSource>[] = [
  { value: "vocals", label: "Vocals" },
  { value: "mix", label: "Mix" },
];

const SPECTRUM_PALETTE_OPTIONS: readonly Option<SpectrumPalette>[] = [
  { value: "heat", label: "Heat" },
  { value: "theme", label: "Theme" },
  { value: "phase", label: "Phase" },
];

const FREQUENCY_SCALE_OPTIONS: readonly Option<FrequencyScale>[] = [
  { value: "mel", label: "Mel" },
  { value: "log", label: "Log" },
  { value: "linear", label: "Linear" },
];

const SPECTRUM_TOP_OPTIONS: readonly Option<SpectrumTop>[] = [
  { value: "full", label: "18 kHz" },
  { value: "voice", label: "8 kHz" },
];

const ANALYSIS_WINDOW_OPTIONS: readonly Option<AnalysisWindow>[] = [
  { value: "auto", label: "Auto" },
  { value: "1024", label: "1024" },
  { value: "2048", label: "2048" },
];

const PHASE_COLOUR_OPTIONS: readonly Option<PhaseColours>[] = [
  { value: "change", label: "Bends" },
  { value: "raw", label: "Raw" },
];

const PITCH_LINE_OPTIONS: readonly Option<PitchLineMode>[] = [
  { value: "always", label: "Always" },
  { value: "focus", label: "Focused line" },
  { value: "off", label: "Off" },
];

// -- Exports -------------------------------------------------------------------

export {
  ANALYSIS_WINDOW_OPTIONS,
  FREQUENCY_SCALE_OPTIONS,
  PHASE_COLOUR_OPTIONS,
  PITCH_LINE_OPTIONS,
  SPECTRUM_PALETTE_OPTIONS,
  SPECTRUM_SOURCE_OPTIONS,
  SPECTRUM_TOP_OPTIONS,
};
