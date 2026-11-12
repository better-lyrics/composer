// -- Functions ----------------------------------------------------------------

function wordBlockId(lineId: string, track: "word" | "bg", wordIndex: number): string {
  return `${lineId}-${track}-${wordIndex}`;
}

// -- Exports ------------------------------------------------------------------

export { wordBlockId };
