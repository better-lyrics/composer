// -- Types --------------------------------------------------------------------

interface ModelFile {
  url: string;
  bytes: number;
}

type ModelKind = "vocal" | "alignment" | "beat";

type GroupedModelFiles = Record<ModelKind, ModelFile[]>;

interface KnownModelUrls {
  vocalFileNames: readonly string[];
  beatUrl: string;
}

// -- Derivations --------------------------------------------------------------

// Alignment is the fallback: it writes many files (model, dictionary, kuromoji), the others one each.
function modelFileName(url: string): string {
  return new URL(url).pathname.split("/").at(-1) ?? url;
}

function modelKindOf(url: string, known: KnownModelUrls): ModelKind {
  if (known.vocalFileNames.includes(modelFileName(url))) return "vocal";
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

export { groupModelFiles, modelFileName, modelFilesBytes };
export type { KnownModelUrls, ModelFile, ModelKind };
