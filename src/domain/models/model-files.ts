// -- Types --------------------------------------------------------------------

interface ModelFile {
  url: string;
  bytes: number;
}

type ModelKind = "vocal" | "alignment" | "beat";

type GroupedModelFiles = Record<ModelKind, ModelFile[]>;

interface KnownModelUrls {
  vocalUrls: readonly string[];
  beatUrl: string;
}

// -- Derivations --------------------------------------------------------------

// Alignment is the fallback: it writes many files (model, dictionary, kuromoji), the others one each.
function modelKindOf(url: string, known: KnownModelUrls): ModelKind {
  if (known.vocalUrls.includes(url)) return "vocal";
  if (url === known.beatUrl) return "beat";
  return "alignment";
}

function groupModelFiles(files: readonly ModelFile[], known: KnownModelUrls): GroupedModelFiles {
  const grouped: GroupedModelFiles = { vocal: [], alignment: [], beat: [] };
  for (const file of files) grouped[modelKindOf(file.url, known)].push(file);
  return grouped;
}

function modelFilesBytes(files: readonly ModelFile[]): number {
  let bytes = 0;
  for (const file of files) bytes += file.bytes;
  return bytes;
}

// -- Exports ------------------------------------------------------------------

export { groupModelFiles, modelFilesBytes };
export type { KnownModelUrls, ModelFile, ModelKind };
