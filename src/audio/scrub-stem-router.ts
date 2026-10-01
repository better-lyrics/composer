import { decodeSourceAudio } from "@/audio/decoded-source-audio";
import { scrubPreview } from "@/audio/scrub-preview";
import type { Stem } from "@/audio/separation/types";

// -- Types ---------------------------------------------------------------------
type LazyAudio = () => Promise<AudioBuffer>;
type CachedStem = { url: string | null; audio: LazyAudio };

// -- Constants -----------------------------------------------------------------
const LOG_PREFIX = "[ScrubStemRouter]";

// -- State ---------------------------------------------------------------------
const cache: Map<Stem, CachedStem> = new Map();
let activeStem: Stem | null = null;

// -- Helpers -------------------------------------------------------------------
function lazyAudio(readSource: () => Promise<Blob>): LazyAudio {
  let decoding: Promise<AudioBuffer> | null = null;
  return () => {
    if (!decoding) {
      const attempt = readSource().then(decodeSourceAudio);
      decoding = attempt;
      attempt.catch(() => {
        if (decoding === attempt) decoding = null;
      });
    }
    return decoding;
  };
}

async function fetchStem(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`fetch failed: ${response.status} ${response.statusText}`);
  }
  return response.blob();
}

function activate(stem: Stem, audio: LazyAudio): void {
  scrubPreview.useLazyBuffer(audio);
  activeStem = stem;
}

function deactivate(): void {
  scrubPreview.useBuffer(null);
  activeStem = null;
}

// -- Public API ----------------------------------------------------------------
function setOriginalSource(source: Blob | null): void {
  if (source) {
    const audio = lazyAudio(async () => source);
    cache.set("original", { url: null, audio });
    if (activeStem === "original" || activeStem === null) {
      activate("original", audio);
    }
    return;
  }
  cache.delete("original");
  if (activeStem === "original") {
    deactivate();
  }
}

function selectStem(stem: Stem, getUrl: () => string | undefined): void {
  if (stem === "original") {
    const original = cache.get("original");
    if (!original) {
      if (activeStem !== null) deactivate();
      return;
    }
    if (activeStem !== "original") activate("original", original.audio);
    return;
  }

  const url = getUrl();
  const cached = cache.get(stem);
  if (cached && cached.url === url) {
    if (activeStem !== stem) activate(stem, cached.audio);
    return;
  }
  if (!url) {
    console.warn(LOG_PREFIX, `no URL provided for stem "${stem}"; staying on previous stem`);
    return;
  }

  const audio = lazyAudio(() => fetchStem(url));
  cache.set(stem, { url, audio });
  activate(stem, audio);
}

function clearCache(): void {
  cache.clear();
  activeStem = null;
  scrubPreview.useBuffer(null);
}

function getActiveStem(): Stem | null {
  return activeStem;
}

const scrubStemRouter = { setOriginalSource, selectStem, clearCache, getActiveStem };

export { scrubStemRouter };
