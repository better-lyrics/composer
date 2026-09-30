import { normalizeLanguageTag } from "@/domain/project/language";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import { isStructurallyEqual } from "@/utils/structural-equal";

// -- Types --------------------------------------------------------------------

type MetadataKey = keyof ProjectMetadata;

interface MetadataAfterImport {
  metadata: ProjectMetadata;
  importedKeys: MetadataKey[];
}

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

function comparableValue(key: MetadataKey, value: ProjectMetadata[MetadataKey]): unknown {
  return key === "language" && typeof value === "string" ? (normalizeLanguageTag(value) ?? value) : value;
}

function withValue<K extends MetadataKey>(
  metadata: ProjectMetadata,
  key: K,
  value: ProjectMetadata[K],
): ProjectMetadata {
  return { ...metadata, [key]: value };
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
  const released = previousImportKeys.reduce((metadata, key) => withValue(metadata, key, defaults[key]), current);
  const filled = filledMetadata(incoming);
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

export { changedMetadata, filledMetadata, importedKeysAfterWrite, isMetadataKey, metadataAfterImport };
export type { MetadataKey };
