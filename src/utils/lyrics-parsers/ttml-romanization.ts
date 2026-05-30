import type { LyricLine, RomanizationData } from "@/domain/line/model";
import { reconcileLine } from "@/domain/line/model";
import { isKnownScheme } from "@/domain/romanization/schemes";
import type { WordTiming } from "@/domain/word/timing";
import { parseTtmlTimestamp } from "@/utils/lyrics-parsers/ttml-helpers";

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

function pickKnownTransliteration(container: Element): Element | null {
  const candidates = container.getElementsByTagName("transliteration");
  for (const el of candidates) {
    const lang = el.getAttribute("xml:lang");
    if (lang && isKnownScheme(lang)) return el;
  }
  return null;
}

function buildRomanizationFromTextNode(textEl: Element): RomanizationData | null {
  const spans: Element[] = [];
  for (const node of textEl.childNodes) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName.toLowerCase() === "span") {
      const span = node as Element;
      if (span.hasAttribute("begin")) spans.push(span);
    }
  }

  if (spans.length > 0) {
    const words: WordTiming[] = [];
    for (const span of spans) {
      const begin = parseTtmlTimestamp(span.getAttribute("begin") ?? "");
      const end = parseTtmlTimestamp(span.getAttribute("end") ?? "");
      const text = span.textContent ?? "";
      if (!text.trim()) continue;
      words.push({ text, begin, end });
    }
    if (words.length === 0) return null;
    return {
      text: words.map((w) => w.text.trim()).join(" "),
      words,
      source: "generated",
    };
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
    const romanization = buildRomanizationFromTextNode(textEl);
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
  const transliteration = pickKnownTransliteration(container);
  if (!transliteration) return { lines };
  const scheme = transliteration.getAttribute("xml:lang") ?? undefined;
  const next = attachRomanization(lines, transliteration, itunesKeyToIndex);
  return { lines: next, scheme };
}

// -- Exports ------------------------------------------------------------------

export { applyTransliterationsFromDoc };
