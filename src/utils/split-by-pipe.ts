// -- Helpers ------------------------------------------------------------------

function splitWordsByPipe(text: string): string[] {
  return text
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .flatMap((token) => {
      const parts = token.split("|").filter((p) => p.length > 0);
      if (parts.length <= 1) return [token];
      // Add trailing space to all but the last part (last gets it from normal word spacing)
      return parts.map((part, i) => (i < parts.length - 1 ? `${part} ` : part));
    });
}

// -- Exports ------------------------------------------------------------------

export { splitWordsByPipe };
