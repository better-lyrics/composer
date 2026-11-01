// -- Types --------------------------------------------------------------------

type PitchLineMode = "always" | "focus" | "off";

// -- Constants ----------------------------------------------------------------

const PITCH_LINE_MODES: readonly PitchLineMode[] = ["always", "focus", "off"];
const DEFAULT_PITCH_LINE_MODE: PitchLineMode = "off";

// -- Functions ----------------------------------------------------------------

function isPitchLineMode(value: unknown): value is PitchLineMode {
  return typeof value === "string" && (PITCH_LINE_MODES as readonly string[]).includes(value);
}

// -- Exports ------------------------------------------------------------------

export { DEFAULT_PITCH_LINE_MODE, isPitchLineMode };
export type { PitchLineMode };
