import { type MetadataKey, isEmptyMetadataValue } from "@/domain/project/imported-metadata";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { isStructurallyEqual } from "@/utils/structural-equal";

// -- Types --------------------------------------------------------------------

type SourceMetadataKey = "title" | "artists" | "album" | "isrc";

type SourceMetadata = Partial<Pick<ProjectMetadata, SourceMetadataKey>>;

// -- Constants ----------------------------------------------------------------

const SOURCE_METADATA_KEYS: readonly SourceMetadataKey[] = ["title", "artists", "album", "isrc"];

const CLEARED: Required<{ [K in SourceMetadataKey]: ProjectMetadata[K] }> = {
  title: "",
  artists: [],
  album: "",
  isrc: undefined,
};

// -- Functions ----------------------------------------------------------------

function isUsersValue(
  key: SourceMetadataKey,
  current: ProjectMetadata,
  importedKeys: readonly MetadataKey[],
  previousSource: SourceMetadata,
): boolean {
  if (isEmptyMetadataValue(current[key])) return false;
  if (importedKeys.includes(key)) return true;
  return !isStructurallyEqual(current[key], previousSource[key]);
}

// A swapped audio source rewrites only what the old source wrote; values the user typed or the lyrics brought stay.
function metadataForNewSource(
  current: ProjectMetadata,
  importedKeys: readonly MetadataKey[],
  previousSource: SourceMetadata,
  nextSource: SourceMetadata,
): SourceMetadata {
  const patch: SourceMetadata = {};
  for (const key of SOURCE_METADATA_KEYS) {
    if (isUsersValue(key, current, importedKeys, previousSource)) continue;
    const next = nextSource[key] ?? CLEARED[key];
    if (!isStructurallyEqual(current[key], next)) Object.assign(patch, { [key]: next });
  }
  return patch;
}

// -- Exports ------------------------------------------------------------------

export { metadataForNewSource };
export type { SourceMetadata };
