import { alignTransliterationToWords } from "@/domain/language/align";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { TransliterationSegment } from "@/domain/language/model";
import { timingWordGroups } from "@/domain/language/transliteration-format";
import { type LyricLine, reconcileLine } from "@/domain/line/model";

const ITUNES_NS = "http://music.apple.com/lyric-ttml-internal";
const XML_NS = "http://www.w3.org/XML/1998/namespace";
const TTM_NS = "http://www.w3.org/ns/ttml#metadata";

const directChildren = (element: Element, name: string) =>
  Array.from(element.children).filter((child) => child.localName === name);
const role = (element: Element) => element.getAttribute("ttm:role") || element.getAttributeNS(TTM_NS, "role");
const languageOf = (element: Element, fallback: string) =>
  element.getAttribute("xml:lang") || element.getAttributeNS(XML_NS, "lang") || fallback;

function textWithoutBackground(element: Element): string {
  let text = "";
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? "";
    else if (node.nodeType === Node.ELEMENT_NODE && role(node as Element) !== "x-bg") text += node.textContent ?? "";
  }
  return text.trim();
}

function decodeTransliterationText(rawText: string, expectedWordGroups: number): string {
  const raw = rawText.trim();
  if (!raw) return "";
  const groups = raw
    .split(/\s{2,}/)
    .map((group) => group.trim())
    .filter(Boolean);
  if (groups.length === expectedWordGroups || expectedWordGroups === 1) {
    return groups.map((group) => group.replace(/\s+/g, "-")).join(" ");
  }
  return raw.replace(/\s+/g, " ");
}

function parseTranslations(
  root: Element,
  lines: LyricLine[],
  lineIndexByKey: Map<string, number>,
  paragraphByKey: Map<string, Element>,
) {
  const translations = directChildren(root, "translations")[0];
  if (!translations) return;
  for (const container of directChildren(translations, "translation")) {
    const language = languageOf(container, "und");
    for (const textElement of directChildren(container, "text")) {
      const key = textElement.getAttribute("for");
      const index = key ? lineIndexByKey.get(key) : undefined;
      if (index === undefined) continue;
      const line = lines[index];
      const sidecarBackground = Array.from(textElement.getElementsByTagName("span")).find(
        (span) => role(span) === "x-bg",
      );
      let backgroundText: string | undefined = sidecarBackground?.textContent?.trim() || undefined;
      const paragraph = key ? paragraphByKey.get(key) : undefined;
      if (!backgroundText) {
        for (const span of Array.from(paragraph?.getElementsByTagName("span") ?? [])) {
          if (role(span) === "x-translation" && languageOf(span, "") === language) {
            backgroundText = span.textContent?.trim() || undefined;
          }
        }
      }
      lines[index] = reconcileLine({
        ...line,
        translations: {
          ...line.translations,
          [language]: {
            language,
            text: textWithoutBackground(textElement),
            backgroundText,
            origin: "import",
            sourceFingerprint: languageSourceFingerprint(line.text, line.backgroundText),
          },
        },
      });
    }
  }
}

function parseTransliterations(root: Element, lines: LyricLine[], lineIndexByKey: Map<string, number>) {
  const transliterations = directChildren(root, "transliterations")[0];
  if (!transliterations) return;
  for (const container of directChildren(transliterations, "transliteration")) {
    const language = languageOf(container, "und-Latn");
    for (const textElement of directChildren(container, "text")) {
      const key = textElement.getAttribute("for");
      const index = key ? lineIndexByKey.get(key) : undefined;
      if (index === undefined) continue;
      const line = lines[index];
      const background =
        Array.from(textElement.getElementsByTagName("span")).find((span) => role(span) === "x-bg") ?? null;
      const text = decodeTransliterationText(
        textWithoutBackground(textElement),
        line.words?.length ? timingWordGroups(line.words).length : line.text.trim().split(/\s+/).filter(Boolean).length,
      );
      const backgroundText = background
        ? decodeTransliterationText(
            background.textContent ?? "",
            line.backgroundWords?.length
              ? timingWordGroups(line.backgroundWords).length
              : line.backgroundText?.trim().split(/\s+/).filter(Boolean).length || 1,
          ) || undefined
        : undefined;
      const segments: TransliterationSegment[] = [{ original: line.text, transliteration: text }];
      const backgroundSegments =
        backgroundText && line.backgroundText
          ? [{ original: line.backgroundText, transliteration: backgroundText }]
          : undefined;
      lines[index] = reconcileLine({
        ...line,
        ...(line.words ? { words: alignTransliterationToWords(line.words, segments) } : {}),
        ...(line.backgroundWords && backgroundSegments
          ? { backgroundWords: alignTransliterationToWords(line.backgroundWords, backgroundSegments) }
          : {}),
        transliteration: {
          language,
          text,
          backgroundText,
          segments,
          backgroundSegments,
          origin: "import",
          sourceFingerprint: languageSourceFingerprint(line.text, line.backgroundText),
        },
      });
    }
  }
}

function parseTtmlAlternates(
  doc: Document,
  lines: LyricLine[],
  lineIndexByKey: Map<string, number>,
  paragraphByKey: Map<string, Element>,
): void {
  const root =
    doc.getElementsByTagName("iTunesMetadata")[0] ?? doc.getElementsByTagNameNS(ITUNES_NS, "iTunesMetadata")[0];
  if (!root) return;
  parseTranslations(root, lines, lineIndexByKey, paragraphByKey);
  parseTransliterations(root, lines, lineIndexByKey);
}

export { parseTtmlAlternates };
