import { normalizeLanguageTag } from "@/domain/project/language";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { toComposerMeta } from "@/domain/project/metadata-ttml";
import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import { isStructurallyEqual } from "@/utils/structural-equal";

// -- Types --------------------------------------------------------------------

type MetadataKey = keyof ProjectMetadata;

interface MetadataAfterImport {
  metadata: ProjectMetadata;
  importedKeys: MetadataKey[];
}

// -- Constants ----------------------------------------------------------------

// These describe the loaded audio, so lyrics or song details from another source never carry them in.
const AUDIO_BOUND_METADATA_KEYS: ReadonlySet<MetadataKey> = new Set([
  "duration",
  "thumbnailDataUrl",
  "thumbnailForVideoId",
]);

const EXPORTED_AS_META_PAIRS: ReadonlySet<MetadataKey> = new Set(["artists", "songwriters", "extra"]);

// -- Helpers ------------------------------------------------------------------

function isMetadataKey(key: string): key is MetadataKey {
  return Object.hasOwn(normalizeLoadedMetadata(null), key);
}

function isEmptyMetadataValue(value: ProjectMetadata[MetadataKey]): boolean {
  if (value === undefined || value === "" || value === 0) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

function withValue<K extends MetadataKey>(
  metadata: ProjectMetadata,
  key: K,
  value: ProjectMetadata[K],
): ProjectMetadata {
  return { ...metadata, [key]: value };
}

function comparableValue(key: MetadataKey, value: ProjectMetadata[MetadataKey]): unknown {
  if (key === "language" && typeof value === "string") return normalizeLanguageTag(value) ?? value;
  if (EXPORTED_AS_META_PAIRS.has(key)) return toComposerMeta(withValue(normalizeLoadedMetadata(null), key, value));
  return value;
}

// -- Functions ----------------------------------------------------------------

function filledMetadata(patch: Partial<ProjectMetadata>): Partial<ProjectMetadata> {
  return Object.fromEntries(
    Object.entries(patch).filter(([key, value]) => isMetadataKey(key) && !isEmptyMetadataValue(value)),
  );
}

function metadataAfterImport(
  current: ProjectMetadata,
  previousImportKeys: readonly MetadataKey[],
  incoming: Partial<ProjectMetadata>,
): MetadataAfterImport {
  const defaults = normalizeLoadedMetadata(null);
  const released = previousImportKeys
    .filter((key) => !AUDIO_BOUND_METADATA_KEYS.has(key))
    .reduce((metadata, key) => withValue(metadata, key, defaults[key]), current);
  const filled = Object.fromEntries(
    Object.entries(filledMetadata(incoming)).filter(
      ([key]) => isMetadataKey(key) && !AUDIO_BOUND_METADATA_KEYS.has(key),
    ),
  );
  return { metadata: { ...released, ...filled }, importedKeys: Object.keys(filled).filter(isMetadataKey) };
}

function importedKeysAfterWrite(importedKeys: readonly MetadataKey[], patch: Partial<ProjectMetadata>): MetadataKey[] {
  return importedKeys.filter((key) => !(key in patch));
}

function changedMetadata(current: ProjectMetadata, incoming: Partial<ProjectMetadata>): Partial<ProjectMetadata> {
  return Object.fromEntries(
    Object.entries(filledMetadata(incoming)).filter(
      ([key, value]) =>
        isMetadataKey(key) && !isStructurallyEqual(comparableValue(key, current[key]), comparableValue(key, value)),
    ),
  );
}

// -- Exports ------------------------------------------------------------------

export {
  AUDIO_BOUND_METADATA_KEYS,
  changedMetadata,
  filledMetadata,
  importedKeysAfterWrite,
  isMetadataKey,
  metadataAfterImport,
};
export type { MetadataKey };
