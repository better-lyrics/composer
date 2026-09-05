// -- Types --------------------------------------------------------------------

interface WordTiming {
  text: string;
  begin: number;
  end: number;
  explicit?: true;
  syllableGroupId?: string;
  /** Display text paired with this exact timing slot. Timing remains canonical. */
  transliteration?: string;
  /** Exact separator to restore between this transliteration fragment and the next when merging syllables. */
  transliterationJoinerAfter?: string;
}

// -- Exports ------------------------------------------------------------------

export type { WordTiming };
