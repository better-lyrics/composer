import type { LyricLine, RomanizationData } from "@/domain/line/model";
import { reconcileLine } from "@/domain/line/model";
import { isKnownScheme } from "@/domain/romanization/schemes";

// -- Helpers ------------------------------------------------------------------

function findTransliterationsElement(doc: Document): Element | null {
  // Try every shape we accept: unprefixed (direct), composer:-prefixed,
  // and recursive search for Apple-wrapped (<iTunesMetadata>) or any nesting
  // depth under <metadata>. Mirrors better-lyrics' prefix-strip approach.
  const direct = doc.getElementsByTagName("transliterations");
  if (direct.length > 0) return direct[0];
  const composerPrefixed = doc.getElementsByTagName("composer:transliterations");
  if (composerPrefixed.length > 0) return composerPrefixed[0];
  return null;
}

function buildRomanizationFromTextNode(textEl: Element, sourceWordCount: number | undefined): RomanizationData | null {
  const spanTexts: string[] = [];
  for (const node of textEl.childNodes) {
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as Element;
    if (el.tagName.toLowerCase() !== "span") continue;
    const text = el.textContent ?? "";
    if (!text.trim()) continue;
    spanTexts.push(text);
  }

  if (spanTexts.length > 0) {
    const joinedText = spanTexts.map((t) => t.trim()).join(" ");
    if (sourceWordCount !== undefined && spanTexts.length === sourceWordCount) {
      return { text: joinedText, wordTexts: spanTexts, source: "generated" };
    }
    return { text: joinedText, source: "generated" };
  }

  const raw = textEl.textContent?.trim() ?? "";
  if (!raw) return null;
  return { text: raw, source: "generated" };
}

// Walks every <text for=...> child of the chosen transliteration and attaches
// romanization to the matching line by `itunes:key`. Lines without a matching
// key (or whose <text> entry is empty) are left untouched.
function attachRomanization(
  lines: LyricLine[],
  transliteration: Element,
  itunesKeyToIndex: Map<string, number>,
): LyricLine[] {
  if (lines.length === 0) return lines;
  const out = lines.slice();
  const textEls = transliteration.getElementsByTagName("text");
  for (const textEl of textEls) {
    const forKey = textEl.getAttribute("for");
    if (!forKey) continue;
    const idx = itunesKeyToIndex.get(forKey);
    if (idx === undefined) continue;
    const romanization = buildRomanizationFromTextNode(textEl, out[idx].words?.length);
    if (!romanization) continue;
    out[idx] = reconcileLine({ ...out[idx], romanization });
  }
  return out;
}

// Two-phase apply: discover the transliterations element, validate its scheme,
// then attach to lines. Returns updated lines + the scheme to set on metadata.
// If no usable transliteration is found, returns the inputs unchanged.
function applyTransliterationsFromDoc(
  doc: Document,
  lines: LyricLine[],
  itunesKeyToIndex: Map<string, number>,
): { lines: LyricLine[]; scheme?: string } {
  const container = findTransliterationsElement(doc);
  if (!container) return { lines };
  const all = Array.from(container.getElementsByTagName("transliteration"));
  let scheme: string | undefined;
  let next = lines;
  for (const transliteration of all) {
    const lang = transliteration.getAttribute("xml:lang");
    if (!lang || !isKnownScheme(lang)) continue;
    if (scheme === undefined) scheme = lang;
    if (lang !== scheme) continue;
    next = attachRomanization(next, transliteration, itunesKeyToIndex);
  }
  return { lines: next, scheme };
}

// -- Exports ------------------------------------------------------------------

export { applyTransliterationsFromDoc };
