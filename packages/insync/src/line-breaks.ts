// -- Constants ----------------------------------------------------------------

const CARRIAGE_RETURN = /\r\n?/g;

// -- Functions ----------------------------------------------------------------

// Windows and classic Mac line breaks become `\n`, as an XML parser reads them.
function withUnixLineBreaks(text: string): string {
  return text.replace(CARRIAGE_RETURN, "\n");
}

// -- Exports ------------------------------------------------------------------

export { withUnixLineBreaks };
