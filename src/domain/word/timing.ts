// -- Types --------------------------------------------------------------------

interface WordTiming {
  text: string;
  begin: number;
  end: number;
  explicit?: true;
  syllableGroupId?: string;
  /** Display text paired with this exact timing slot. Timing remains canonical. */
  transliteration?: string;
}

// -- Exports ------------------------------------------------------------------

export type { WordTiming };
