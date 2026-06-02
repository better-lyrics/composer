import { encodeBatch, parseBatchResponse } from "@/utils/romanization/google/batch";
import type { GoogleCache } from "@/utils/romanization/google/cache";
import { chunkLinesByBody } from "@/utils/romanization/google/chunk";
import { fetchGoogleRomanization, RateLimitError } from "@/utils/romanization/google/fetch";

const DEFAULT_MAX_BODY = 15_000;

interface RomanizeLinesArgs {
  sourceLang: string;
  lines: ReadonlyArray<ReadonlyArray<string>>;
  cache: GoogleCache;
  throttle: <T>(fn: () => Promise<T>) => Promise<T>;
  signal?: AbortSignal;
  maxBody?: number;
}

interface UncachedLineRef {
  originalLineIdx: number;
  uncachedWords: string[];
  uncachedSlots: number[];
}

async function romanizeLinesViaGoogle(args: RomanizeLinesArgs): Promise<Array<string[] | null>> {
  if (args.lines.length === 0) return [];

  const cached: Array<Array<string | undefined>> = await Promise.all(
    args.lines.map((words) => Promise.all(words.map((word) => args.cache.get(args.sourceLang, word)))),
  );

  const uncachedLines: UncachedLineRef[] = [];
  for (let lineIdx = 0; lineIdx < cached.length; lineIdx++) {
    const row = cached[lineIdx];
    const missingWords: string[] = [];
    const missingSlots: number[] = [];
    for (let wordIdx = 0; wordIdx < row.length; wordIdx++) {
      if (row[wordIdx] === undefined) {
        missingWords.push(args.lines[lineIdx][wordIdx]);
        missingSlots.push(wordIdx);
      }
    }
    if (missingWords.length > 0) {
      uncachedLines.push({
        originalLineIdx: lineIdx,
        uncachedWords: missingWords,
        uncachedSlots: missingSlots,
      });
    }
  }

  if (uncachedLines.length === 0) {
    return finalize(cached);
  }

  const maxBody = args.maxBody ?? DEFAULT_MAX_BODY;
  const chunks = chunkLinesByBody(
    uncachedLines.map((line) => line.uncachedWords),
    { maxBody },
  );

  let uncachedCursor = 0;
  for (const chunk of chunks) {
    const linesInChunk = chunk.length;
    const refs = uncachedLines.slice(uncachedCursor, uncachedCursor + linesInChunk);
    uncachedCursor += linesInChunk;

    const wordCounts = chunk.map((line) => line.length);
    let parsed: Array<string[] | null>;
    try {
      const { romaji } = await args.throttle(() =>
        fetchGoogleRomanization({
          sourceLang: args.sourceLang,
          text: encodeBatch(chunk),
          signal: args.signal,
        }),
      );
      parsed = parseBatchResponse(romaji, wordCounts);
    } catch (err) {
      if (err instanceof RateLimitError) throw err;
      parsed = wordCounts.map(() => null);
    }

    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      const row = parsed[i];
      if (!row) continue;
      const pairs: Array<[string, string]> = [];
      for (let j = 0; j < ref.uncachedSlots.length; j++) {
        const slot = ref.uncachedSlots[j];
        const romaji = row[j];
        cached[ref.originalLineIdx][slot] = romaji;
        pairs.push([ref.uncachedWords[j], romaji]);
      }
      if (pairs.length > 0) await args.cache.setMany(args.sourceLang, pairs);
    }
  }

  return finalize(cached);
}

function finalize(cached: Array<Array<string | undefined>>): Array<string[] | null> {
  return cached.map((row) => (row.includes(undefined) ? null : (row as string[])));
}

export { RateLimitError, romanizeLinesViaGoogle };
export type { RomanizeLinesArgs };
