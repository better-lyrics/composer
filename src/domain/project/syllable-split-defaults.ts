// -- Types --------------------------------------------------------------------

interface SyllableSplitDefaults {
  applyToAll: boolean;
  caseInsensitive: boolean;
}

// -- Constants ----------------------------------------------------------------

const DEFAULT_SYLLABLE_SPLIT_DEFAULTS: SyllableSplitDefaults = {
  applyToAll: false,
  caseInsensitive: false,
};

// -- Exports ------------------------------------------------------------------

export { DEFAULT_SYLLABLE_SPLIT_DEFAULTS };
export type { SyllableSplitDefaults };
