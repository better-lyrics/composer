import type { SongDetails } from "@/domain/musicbrainz/song-details";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { normalizeIsrc } from "@/utils/isrc";

// -- Types --------------------------------------------------------------------

// A list fill holds only the names missing from the field; Fill appends them.
interface Suggestion<T> {
  kind: "fill" | "differs";
  value: T;
}

interface MetadataSuggestions {
  album?: Suggestion<string>;
  isrc?: Suggestion<string>;
  artists?: Suggestion<string[]>;
  songwriters?: Suggestion<string[]>;
}

type SuggestedField = keyof MetadataSuggestions;

// -- Comparison ---------------------------------------------------------------

const comparable = (value: string): string => value.trim().split(/\s+/).join(" ").toLowerCase();

const includesName = (names: string[], name: string): boolean =>
  names.some((existing) => comparable(existing) === comparable(name));

const nonBlank = (values: string[] | undefined): string[] => (values ?? []).filter((value) => value.trim() !== "");

function textSuggestion(current: string | undefined, next: string | null): Suggestion<string> | undefined {
  if (!next) return undefined;
  if (!current?.trim()) return { kind: "fill", value: next };
  return comparable(current) === comparable(next) ? undefined : { kind: "differs", value: next };
}

function listSuggestion(current: string[] | undefined, next: string[]): Suggestion<string[]> | undefined {
  if (next.length === 0) return undefined;
  const existing = nonBlank(current);
  if (existing.some((name) => !includesName(next, name))) return { kind: "differs", value: next };
  const missing = next.filter((name) => !includesName(existing, name));
  return missing.length === 0 ? undefined : { kind: "fill", value: missing };
}

// -- Suggestions --------------------------------------------------------------

function metadataSuggestions(details: SongDetails, metadata: ProjectMetadata): MetadataSuggestions {
  const suggestions: MetadataSuggestions = {};
  const album = textSuggestion(metadata.album, details.album);
  const isrc = textSuggestion(metadata.isrc && (normalizeIsrc(metadata.isrc) ?? metadata.isrc), details.isrc);
  const artists = listSuggestion(metadata.artists, details.artists);
  const songwriters = listSuggestion(metadata.songwriters, details.songwriters);
  if (album) suggestions.album = album;
  if (isrc) suggestions.isrc = isrc;
  if (artists) suggestions.artists = artists;
  if (songwriters) suggestions.songwriters = songwriters;
  return suggestions;
}

function fillPatch(suggestions: MetadataSuggestions, metadata: ProjectMetadata): Partial<ProjectMetadata> {
  const patch: Partial<ProjectMetadata> = {};
  if (suggestions.album?.kind === "fill") patch.album = suggestions.album.value;
  if (suggestions.isrc?.kind === "fill") patch.isrc = suggestions.isrc.value;
  if (suggestions.artists?.kind === "fill")
    patch.artists = [...nonBlank(metadata.artists), ...suggestions.artists.value];
  if (suggestions.songwriters?.kind === "fill") {
    patch.songwriters = [...nonBlank(metadata.songwriters), ...suggestions.songwriters.value];
  }
  return patch;
}

const suggestionCount = (suggestions: MetadataSuggestions): number => Object.keys(suggestions).length;

// -- Exports ------------------------------------------------------------------

export { fillPatch, metadataSuggestions, suggestionCount };
export type { MetadataSuggestions, SuggestedField, Suggestion };
