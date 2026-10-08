import type { ModelDescriptor } from "@/audio/separation/model-registry";

// Any large file fetched once and kept: the vocal model, the alignment model
// and its dictionary all share this cache.
type CachedAsset = Pick<ModelDescriptor, "url" | "approxBytes">;

const CACHE_NAME = "composer-vocal-model-v1";

type DownloadProgress = (loaded: number, total: number) => void;

async function hasCachedModel(model: CachedAsset): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(model.url);
  return hit !== undefined;
}

async function readCachedModel(model: CachedAsset): Promise<ArrayBuffer | null> {
  if (typeof caches === "undefined") return null;
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(model.url);
  if (!hit) return null;
  return hit.arrayBuffer();
}

// Caching is best effort: with little free storage the write fails, and the
// model should still load for this session rather than fail outright.
async function storeInCache(model: CachedAsset, bytes: ArrayBuffer | Uint8Array): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(model.url, new Response(bytes, { headers: { "content-type": "application/octet-stream" } }));
  } catch (err) {
    console.warn(`[model-cache] could not cache ${model.url}; it will download again next time`, err);
  }
}

async function fetchAndCacheModel(
  model: CachedAsset,
  signal: AbortSignal,
  onProgress: DownloadProgress,
): Promise<ArrayBuffer> {
  const response = await fetch(model.url, { signal });
  if (!response.ok) {
    throw new Error(`Model fetch failed (${response.status} ${response.statusText})`);
  }

  const contentLengthHeader = response.headers.get("content-length");
  const total = contentLengthHeader ? Number(contentLengthHeader) : model.approxBytes;

  const reader = response.body?.getReader();
  if (!reader) {
    const buf = await response.arrayBuffer();
    onProgress(buf.byteLength, buf.byteLength);
    await storeInCache(model, buf);
    return buf;
  }

  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (signal.aborted) {
      reader.cancel().catch(() => {});
      throw new DOMException("Aborted", "AbortError");
    }
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      onProgress(loaded, total);
    }
  }

  const merged = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  await storeInCache(model, merged);
  return merged.buffer;
}

export { hasCachedModel, readCachedModel, fetchAndCacheModel };
export type { CachedAsset };
