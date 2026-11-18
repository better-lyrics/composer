// -- Functions ----------------------------------------------------------------

// The row of the Edit text that `offset` falls in, counted without splitting the text.
function rowAt(text: string, offset: number): number {
  let row = 0;
  for (let at = text.indexOf("\n"); at !== -1 && at < offset; at = text.indexOf("\n", at + 1)) row++;
  return row;
}

const rowCount = (text: string): number => rowAt(text, text.length) + 1;

// -- Exports ------------------------------------------------------------------

export { rowAt, rowCount };
