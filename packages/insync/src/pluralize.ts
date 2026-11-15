// -- Helpers ------------------------------------------------------------------

function pluralWord(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${pluralWord(count, singular, plural)}`;
}

// -- Exports ------------------------------------------------------------------

export { pluralize, pluralWord };
