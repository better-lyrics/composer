// -- Helpers ------------------------------------------------------------------

function cleanPipes(text: string): string {
  return text
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) => {
      // Strip leading/trailing pipes, collapse consecutive pipes
      const cleaned = token
        .replace(/^\|+/, "")
        .replace(/\|+$/, "")
        .replace(/\|{2,}/g, "|");
      return cleaned || token.replace(/\|/g, "");
    })
    .filter(Boolean)
    .join(" ");
}

// -- Exports ------------------------------------------------------------------

export { cleanPipes };
