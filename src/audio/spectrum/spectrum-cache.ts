import { derivedRecordKey, getDerivedRecord, putDerivedRecords } from "@/audio/separation/stem-derived-records";
import type { SpectrumSource } from "@/domain/spectrum/settings";
import { notifyStorageSignal } from "@/lib/storage-signals";

// -- Types --------------------------------------------------------------------

interface CachedSpectrumChunk {
  magnitude: Uint8Array;
  phaseChange: Uint8Array;
}

interface SpectrumChunkWriter {
  add(chunk: number, magnitude: Uint8Array, phaseChange: Uint8Array): void;
  flush(): Promise<void>;
}

// -- Constants ----------------------------------------------------------------

const SPECTRUM_CACHE_VERSION = 1;
const CHUNKS_PER_WRITE = 16;
const LOG_PREFIX = "[Spectrum cache]";

// -- Functions ----------------------------------------------------------------

// An empty decode tag keeps the key every unaffected source was cached under.
function spectrumChunkKey(
  jobKey: string,
  source: SpectrumSource,
  decodeTag: string,
  sampleRate: number,
  fftSize: number,
  chunk: number,
): string {
  const tagged = decodeTag ? [decodeTag] : [];
  return derivedRecordKey(
    jobKey,
    "spectrum",
    source,
    sampleRate,
    fftSize,
    chunk,
    `v${SPECTRUM_CACHE_VERSION}`,
    ...tagged,
  );
}

async function readSpectrumChunks(
  jobKey: string,
  source: SpectrumSource,
  decodeTag: string,
  sampleRate: number,
  fftSize: number,
  chunkTotal: number,
): Promise<Map<number, CachedSpectrumChunk>> {
  const chunks = new Map<number, CachedSpectrumChunk>();
  const blobs = await Promise.all(
    Array.from({ length: chunkTotal }, (_, chunk) =>
      getDerivedRecord(spectrumChunkKey(jobKey, source, decodeTag, sampleRate, fftSize, chunk)),
    ),
  );
  await Promise.all(
    blobs.map(async (blob, chunk) => {
      if (!blob) return;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const half = bytes.length / 2;
      chunks.set(chunk, { magnitude: bytes.subarray(0, half), phaseChange: bytes.subarray(half) });
    }),
  );
  return chunks;
}

// Each record is the chunk's magnitude followed by its phase change. Raw phase is never stored.
function createSpectrumChunkWriter(
  jobKey: string,
  source: SpectrumSource,
  decodeTag: string,
  sampleRate: number,
  fftSize: number,
): SpectrumChunkWriter {
  let batch = new Map<string, Blob>();
  let writes = Promise.resolve();

  const write = () => {
    if (batch.size === 0) return writes;
    const records = batch;
    batch = new Map();
    writes = writes
      .then(() => putDerivedRecords(jobKey, records))
      .then(
        (written) => {
          if (written) notifyStorageSignal("media-stored");
        },
        (error: unknown) => console.error(LOG_PREFIX, "could not store spectrum chunks", error),
      );
    return writes;
  };

  return {
    add(chunk, magnitude, phaseChange) {
      const blob = new Blob([magnitude.slice(), phaseChange.slice()], { type: "application/octet-stream" });
      batch.set(spectrumChunkKey(jobKey, source, decodeTag, sampleRate, fftSize, chunk), blob);
      if (batch.size >= CHUNKS_PER_WRITE) void write();
    },
    flush: write,
  };
}

// -- Exports ------------------------------------------------------------------

export { createSpectrumChunkWriter, readSpectrumChunks };
export type { CachedSpectrumChunk, SpectrumChunkWriter };
