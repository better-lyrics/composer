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

function withoutVideoThumbnail(metadata: ProjectMetadata): Partial<ProjectMetadata> {
  if (metadata.thumbnailForVideoId === undefined) return {};
  return { thumbnailDataUrl: undefined, thumbnailForVideoId: undefined };
}

function sourceSwapPatch(
  current: ProjectMetadata,
  importedKeys: readonly MetadataKey[],
  previousSource: SourceMetadata,
  nextSource: SourceMetadata,
): Partial<ProjectMetadata> {
  return {
    ...metadataForNewSource(current, importedKeys, previousSource, nextSource),
    ...withoutVideoThumbnail(current),
  };
}

function undoSourceSwap(
  current: ProjectMetadata,
  beforeSwap: ProjectMetadata,
  patch: Partial<ProjectMetadata>,
): Partial<ProjectMetadata> {
  const undo: Partial<ProjectMetadata> = {};
  for (const key of Object.keys(patch) as MetadataKey[]) {
    if (isStructurallyEqual(current[key], patch[key])) Object.assign(undo, { [key]: beforeSwap[key] });
  }
  return undo;
}

// -- Exports ------------------------------------------------------------------

export { metadataForNewSource, sourceSwapPatch, undoSourceSwap };
export type { SourceMetadata };
