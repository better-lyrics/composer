import type { Stem } from "@/audio/separation/types";
import { STEM_SLOTS, type StemSlot } from "@/domain/stems/stem-slot";
import type { ResolvedStem } from "@/stores/stem-sources";

// -- Module state -------------------------------------------------------------

const urlKeys = new Map<string, string>();

// -- URLs ---------------------------------------------------------------------

// Keeps the URL of a stem that did not change, so playback and stem analysis never restart for it.
function nextStemUrls(
  current: Partial<Record<Stem, string>>,
  slots: Partial<Record<StemSlot, ResolvedStem>>,
): Partial<Record<Stem, string>> {
  const next: Partial<Record<Stem, string>> = {};
  for (const slot of STEM_SLOTS) {
    const stem = slots[slot];
    const url = current[slot];
    if (stem && url && urlKeys.get(url) === stem.key) {
      next[slot] = url;
      continue;
    }
    if (!stem) continue;
    const created = URL.createObjectURL(stem.file);
    urlKeys.set(created, stem.key);
    next[slot] = created;
  }
  const kept = new Set(Object.values(next));
  for (const url of Object.values(current)) {
    if (url && !kept.has(url)) releaseStemUrl(url);
  }
  return next;
}

function releaseStemUrl(url: string): void {
  URL.revokeObjectURL(url);
  urlKeys.delete(url);
}

function releaseStemUrls(urls: Partial<Record<Stem, string>>): void {
  for (const url of Object.values(urls)) {
    if (url) releaseStemUrl(url);
  }
}

// -- Exports ------------------------------------------------------------------

export { nextStemUrls, releaseStemUrls };
