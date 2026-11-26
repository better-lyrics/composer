// -- Types --------------------------------------------------------------------

interface WordTiming {
  /** Session id, unique within its track. Never saved in format 3. */
  id: string;
  text: string;
  /** Literal text after this word (spaces, U+3000, nothing); `text` never ends with whitespace. */
  sep: string;
  begin: number;
  end: number;
  explicit?: true;
  /** This syllable and the next one form one word. Set by whoever creates the syllables. */
  joinsNext: boolean;
  /** Display text paired with this exact timing slot. Timing remains canonical. */
  transliteration?: string;
  /** Exact separator to restore between this transliteration fragment and the next when merging syllables. */
  transliterationJoinerAfter?: string;
}

// -- Exports ------------------------------------------------------------------

export type { WordTiming };
