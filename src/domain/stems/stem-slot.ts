// -- Types --------------------------------------------------------------------

type StemSlot = "vocals" | "instrumental";

type StemOrigin = "imported" | "separated";

// -- Constants ----------------------------------------------------------------

const STEM_SLOTS: readonly StemSlot[] = ["vocals", "instrumental"];

// -- Exports ------------------------------------------------------------------

export { STEM_SLOTS };
export type { StemOrigin, StemSlot };
