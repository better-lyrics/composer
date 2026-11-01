import type { SyllablePosition } from "@/domain/word/syllable-groups";

// -- Constants -----------------------------------------------------------------

const SYLLABLE_RADIUS: Record<SyllablePosition, string | undefined> = {
  none: undefined,
  first: "rounded-r-none",
  middle: "rounded-l-none rounded-r-none",
  last: "rounded-l-none",
};

// -- Exports -------------------------------------------------------------------

export { SYLLABLE_RADIUS };
