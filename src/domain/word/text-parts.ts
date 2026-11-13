// -- Types --------------------------------------------------------------------

interface TextPart {
  text: string;
  sep: string;
  joinsNext: boolean;
}

// -- Constants ----------------------------------------------------------------

const TOKEN_AND_SPACE = /(\S+)(\s*)/g;

// -- Functions ----------------------------------------------------------------

// Lyrics text split into its syllable parts: whitespace ends a word and is kept exactly as typed; the split
// character joins parts inside one. Leading whitespace has no part to follow.
function textParts(text: string, splitChar: string): TextPart[] {
  const parts: TextPart[] = [];
  for (const [, token, space] of text.matchAll(TOKEN_AND_SPACE)) {
    const pieces = token.split(splitChar).filter((piece) => piece.length > 0);
    pieces.forEach((piece, index) => {
      const endsToken = index === pieces.length - 1;
      parts.push({ text: piece, sep: endsToken ? space : "", joinsNext: !endsToken });
    });
  }
  return parts;
}

// -- Exports ------------------------------------------------------------------

export type { TextPart };
export { textParts };
