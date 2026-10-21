import type { SongDetails } from "@/domain/musicbrainz/song-details";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { normalizeIsrc } from "@/utils/isrc";

// -- Types --------------------------------------------------------------------

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

const sameList = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((value, index) => comparable(value) === comparable(b[index]));

const nonBlank = (values: string[] | undefined): string[] => (values ?? []).filter((value) => value.trim() !== "");

function textSuggestion(current: string | undefined, next: string | null): Suggestion<string> | undefined {
  if (!next) return undefined;
  if (!current?.trim()) return { kind: "fill", value: next };
  return comparable(current) === comparable(next) ? undefined : { kind: "differs", value: next };
}

function listSuggestion(current: string[] | undefined, next: string[]): Suggestion<string[]> | undefined {
  if (next.length === 0) return undefined;
  const existing = nonBlank(current);
  if (existing.length === 0) return { kind: "fill", value: next };
  return sameList(existing, next) ? undefined : { kind: "differs", value: next };
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

function fillPatch(suggestions: MetadataSuggestions): Partial<ProjectMetadata> {
  const patch: Partial<ProjectMetadata> = {};
  if (suggestions.album?.kind === "fill") patch.album = suggestions.album.value;
  if (suggestions.isrc?.kind === "fill") patch.isrc = suggestions.isrc.value;
  if (suggestions.artists?.kind === "fill") patch.artists = suggestions.artists.value;
  if (suggestions.songwriters?.kind === "fill") patch.songwriters = suggestions.songwriters.value;
  return patch;
}

const suggestionCount = (suggestions: MetadataSuggestions): number => Object.keys(suggestions).length;

// -- Exports ------------------------------------------------------------------

export { fillPatch, metadataSuggestions, suggestionCount };
export type { MetadataSuggestions, SuggestedField, Suggestion };
