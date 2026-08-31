import { alignTrackToLine } from "@/domain/language/align";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { TransliterationSegment } from "@/domain/language/model";
import { normalizeTransliterationForEditing } from "@/domain/language/transliteration-format";
import { type LyricLine, reconcileLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { parseTtmlTimestamp } from "@/utils/lyrics-parsers/ttml-helpers";

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

function decodeTransliterationText(rawText: string): string {
  return normalizeTransliterationForEditing(rawText);
}

function directTimedSpans(element: Element): Element[] {
  return directChildren(element, "span").filter((span) => span.hasAttribute("begin"));
}

function mappedWordsFromSpans(words: WordTiming[] | undefined, text: string, spans: Element[]): WordTiming[] | null {
  if (!words || words.length !== spans.length || spans.length === 0) return null;
  const fragments = spans.map((span) => span.textContent?.trim() ?? "");
  if (fragments.some((fragment) => !fragment)) return null;
  const timingMatches = words.every((word, index) => {
    const span = spans[index];
    const begin = parseTtmlTimestamp(span.getAttribute("begin") ?? "");
    const end = parseTtmlTimestamp(span.getAttribute("end") ?? "");
    return Math.abs(word.begin - begin) < 0.002 && Math.abs(word.end - end) < 0.002;
  });
  if (!timingMatches) return null;

  let cursor = 0;
  const joiners: string[] = [];
  for (let index = 0; index < fragments.length; index++) {
    const start = text.indexOf(fragments[index], cursor);
    if (start < cursor || (index === 0 && text.slice(0, start).trim())) return null;
    if (index > 0) joiners.push(text.slice(cursor, start));
    cursor = start + fragments[index].length;
  }
  if (text.slice(cursor).trim()) return null;

  return words.map((word, index) => {
    const { transliterationJoinerAfter: _joiner, ...withoutJoiner } = word;
    return {
      ...withoutJoiner,
      transliteration: fragments[index],
      ...(index < words.length - 1 ? { transliterationJoinerAfter: joiners[index] } : {}),
    };
  });
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
      const text = decodeTransliterationText(textWithoutBackground(textElement));
      const backgroundText = background
        ? decodeTransliterationText(background.textContent ?? "") || undefined
        : undefined;
      const mappedWords = mappedWordsFromSpans(line.words, text, directTimedSpans(textElement));
      const mappedBackgroundWords = backgroundText
        ? mappedWordsFromSpans(line.backgroundWords, backgroundText, background ? directTimedSpans(background) : [])
        : null;
      const segments: TransliterationSegment[] = [{ original: line.text, transliteration: text }];
      const backgroundSegments =
        backgroundText && line.backgroundText
          ? [{ original: line.backgroundText, transliteration: backgroundText }]
          : undefined;
      const track = {
        language,
        text,
        backgroundText,
        segments,
        backgroundSegments,
        origin: "import",
        sourceFingerprint: languageSourceFingerprint(line.text, line.backgroundText),
      } as const;
      const mappedLine = reconcileLine({
        ...line,
        ...(mappedWords ? { words: mappedWords } : {}),
        ...(mappedBackgroundWords ? { backgroundWords: mappedBackgroundWords } : {}),
      });
      lines[index] = reconcileLine({ ...mappedLine, ...alignTrackToLine(mappedLine, track) });
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
