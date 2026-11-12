import type { ModelDescriptor } from "@/audio/separation/model-registry";
import { readBodyWithProgress } from "@/utils/read-response-body";

const MODEL_CACHE_NAME = "composer-vocal-model-v1";
const LOG_PREFIX = "[ModelCache]";

type DownloadProgress = (loaded: number, total: number) => void;
// Any large file fetched once and kept: the vocal model, the alignment model
// and its dictionary all share this cache. A pinned sha256 is checked before the
// download is cached, so a cached file is always the pinned one.
type CachedModel = Pick<ModelDescriptor, "url" | "approxBytes"> & { sha256?: string };

class IntegrityError extends Error {
  readonly code = "integrity-mismatch";
  constructor(url: string) {
    super(`${url} doesn't match its pinned checksum.`);
    this.name = "IntegrityError";
  }
}

async function sha256Hex(bytes: ArrayBuffer | Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyAndCache(model: CachedModel, bytes: ArrayBuffer | Uint8Array<ArrayBuffer>): Promise<void> {
  if (model.sha256 && (await sha256Hex(bytes)) !== model.sha256) throw new IntegrityError(model.url);
  await storeInCache(model, bytes);
}

async function hasCachedModel(model: CachedModel): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  const cache = await caches.open(MODEL_CACHE_NAME);
  const hit = await cache.match(model.url);
  return hit !== undefined;
}

async function readCachedModel(model: CachedModel): Promise<ArrayBuffer | null> {
  if (typeof caches === "undefined") return null;
  const cache = await caches.open(MODEL_CACHE_NAME);
  const hit = await cache.match(model.url);
  if (!hit) return null;
  return hit.arrayBuffer();
}

// Caching is best effort: with little free storage the write fails, and the
// model should still load for this session rather than fail outright.
async function storeInCache(model: CachedModel, bytes: ArrayBuffer | Uint8Array): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const cache = await caches.open(MODEL_CACHE_NAME);
    await cache.put(model.url, new Response(bytes, { headers: { "content-type": "application/octet-stream" } }));
  } catch (err) {
    console.warn(`${LOG_PREFIX} could not cache ${model.url}; it will download again next time`, err);
  }
}

async function fetchAndCacheModel(
  model: CachedModel,
  signal: AbortSignal,
  onProgress: DownloadProgress,
): Promise<ArrayBuffer> {
  const response = await fetch(model.url, { signal });
  if (!response.ok) {
    throw new Error(`Model fetch failed (${response.status} ${response.statusText})`);
  }

  const bytes = await readBodyWithProgress(response, ({ received, total }) =>
    onProgress(received, total ?? model.approxBytes),
  );
  onProgress(bytes.byteLength, bytes.byteLength);
  await verifyAndCache(model, bytes);
  return bytes;
}

export { MODEL_CACHE_NAME, hasCachedModel, readCachedModel, fetchAndCacheModel };
export type { CachedModel };
