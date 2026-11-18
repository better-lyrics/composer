// -- Constants ----------------------------------------------------------------

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

// -- Functions ----------------------------------------------------------------

// Whether the text holds a letter or digit in any script.
function hasLetterOrDigit(text: string): boolean {
  return LETTER_OR_DIGIT.test(text);
}

// -- Exports ------------------------------------------------------------------

export { hasLetterOrDigit };
