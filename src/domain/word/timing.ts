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
}

// -- Exports ------------------------------------------------------------------

export type { WordTiming };
