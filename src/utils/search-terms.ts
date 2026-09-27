// -- Search Terms ---------------------------------------------------------------

function splitSearchTerms(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0);
}

function matchesAllTerms(haystack: string, terms: readonly string[]): boolean {
  const lowered = haystack.toLowerCase();
  return terms.every((term) => lowered.includes(term));
}

// -- Exports -------------------------------------------------------------------

export { matchesAllTerms, splitSearchTerms };
