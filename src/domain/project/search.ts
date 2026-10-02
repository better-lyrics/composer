import type { ProjectIndexEntry } from "@/domain/project/index-entry";

// -- Constants ----------------------------------------------------------------

const FIELD_SEPARATOR = "\n";

// -- Helpers ------------------------------------------------------------------

function searchable(field: string): string {
  return field.normalize("NFC").toLowerCase();
}

// -- Search -------------------------------------------------------------------

function normalizeProjectQuery(query: string): string {
  return searchable(query.trim());
}

function projectMatchesQuery(entry: ProjectIndexEntry, needle: string): boolean {
  if (needle === "") return true;
  return searchable([entry.title, entry.album, ...entry.artists].join(FIELD_SEPARATOR)).includes(needle);
}

// -- Exports ------------------------------------------------------------------

export { normalizeProjectQuery, projectMatchesQuery };
