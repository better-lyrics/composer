import {
  type DecodedSource,
  keepDecodedSource,
  releaseDecodedSource,
  takeDecodedSource,
  withDecodedSource,
} from "@/audio/decoded-source-audio";
import { scrubPreview } from "@/audio/scrub-preview";
import type { ScrubBuffer } from "@/audio/scrub-stretch";
import type { Stem } from "@/audio/separation/types";

// -- Types ---------------------------------------------------------------------
type LazyAudio = () => Promise<ScrubBuffer>;
type CachedStem = { url: string | null; audio: LazyAudio };

// -- Constants -----------------------------------------------------------------
const LOG_PREFIX = "[ScrubStemRouter]";

// -- State ---------------------------------------------------------------------
const cache: Map<Stem, CachedStem> = new Map();
let activeStem: Stem | null = null;
let originalSource: Blob | null = null;
let originalInScrub = false;
let stemsAvailable = false;

// -- Helpers -------------------------------------------------------------------
function scrubBufferOf({ duration, channels }: DecodedSource): ScrubBuffer {
  return { duration, numberOfChannels: channels.length, getChannelData: (channel) => channels[channel] };
}

function lentScrubBufferOf(decoded: DecodedSource): ScrubBuffer {
  return { ...scrubBufferOf(decoded), lent: true };
}

// With stems to switch between, the original stays decoded beside the node, so every way back to it is instant.
function originalScrubBuffer(source: Blob): Promise<ScrubBuffer> {
  if (stemsAvailable) {
    return keepDecodedSource(source).then(() => withDecodedSource(source, lentScrubBufferOf));
  }
  originalInScrub = true;
  return takeDecodedSource(source, scrubBufferOf);
}

// The stem bytes are kept, never the decoded audio: scrub preview moves the samples into its node.
function lazyAudio(
  readSource: () => Promise<Blob>,
  decode: (source: Blob) => Promise<ScrubBuffer> = (source) => takeDecodedSource(source, scrubBufferOf),
): LazyAudio {
  let reading: Promise<Blob> | null = null;
  return () => {
    if (!reading) {
      const attempt = readSource();
      reading = attempt;
      attempt.catch(() => {
        if (reading === attempt) reading = null;
      });
    }
    return reading.then(decode);
  };
}

// The original's samples leave with it when scrub moves to a stem, so they are decoded again and kept for the way back.
function keepOriginalForReturn(): void {
  if (!originalSource || !originalInScrub) return;
  originalInScrub = false;
  keepDecodedSource(originalSource).catch((err: unknown) =>
    console.warn(LOG_PREFIX, "could not keep the original audio for scrub preview", err),
  );
}

async function fetchStem(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`fetch failed: ${response.status} ${response.statusText}`);
  }
  return response.blob();
}

function activate(stem: Stem, audio: LazyAudio): void {
  if (activeStem === "original" && stem !== "original") keepOriginalForReturn();
  scrubPreview.useLazyBuffer(audio);
  activeStem = stem;
}

function deactivate(): void {
  scrubPreview.useBuffer(null);
  activeStem = null;
}

// -- Public API ----------------------------------------------------------------
function setOriginalSource(source: Blob | null): void {
  if (source !== originalSource) {
    if (originalSource) releaseDecodedSource(originalSource);
    originalSource = source;
    originalInScrub = false;
  }
  if (source) {
    const audio = lazyAudio(async () => source, originalScrubBuffer);
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

function dropStaleStems(getUrl: (stem: Stem) => string | undefined): void {
  for (const [stem, cached] of cache) {
    if (stem !== "original" && stem !== activeStem && cached.url !== getUrl(stem)) cache.delete(stem);
  }
}

function selectStem(stem: Stem, getUrl: (stem: Stem) => string | undefined): void {
  dropStaleStems(getUrl);
  if (stem === "original") {
    const original = cache.get("original");
    if (!original) {
      if (activeStem !== null) deactivate();
      return;
    }
    if (activeStem !== "original") activate("original", original.audio);
    return;
  }

  const url = getUrl(stem);
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

function setStemsAvailable(available: boolean): void {
  stemsAvailable = available;
}

function clearCache(): void {
  if (originalSource) releaseDecodedSource(originalSource);
  originalSource = null;
  originalInScrub = false;
  cache.clear();
  activeStem = null;
  scrubPreview.useBuffer(null);
}

function getCachedStems(): Stem[] {
  return [...cache.keys()];
}

function getActiveStem(): Stem | null {
  return activeStem;
}

const scrubStemRouter = {
  setOriginalSource,
  setStemsAvailable,
  selectStem,
  clearCache,
  getActiveStem,
  getCachedStems,
};

export { scrubStemRouter };
