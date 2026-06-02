import { encodeBatch } from "@/utils/romanization/google/batch";

interface ChunkOpts {
  maxBody: number;
}

function estimateBodyBytes(chunk: ReadonlyArray<ReadonlyArray<string>>): number {
  return `q=${encodeURIComponent(encodeBatch(chunk))}`.length;
}

function chunkLinesByBody(
  lines: ReadonlyArray<ReadonlyArray<string>>,
  opts: ChunkOpts,
): Array<Array<ReadonlyArray<string>>> {
  const chunks: Array<Array<ReadonlyArray<string>>> = [];
  let current: Array<ReadonlyArray<string>> = [];

  for (const line of lines) {
    if (current.length === 0) {
      current.push(line);
      continue;
    }
    const candidate = [...current, line];
    if (estimateBodyBytes(candidate) <= opts.maxBody) {
      current = candidate;
    } else {
      chunks.push(current);
      current = [line];
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export { chunkLinesByBody };
export type { ChunkOpts };
