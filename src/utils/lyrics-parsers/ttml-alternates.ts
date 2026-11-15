import { alignTrackToLine } from "@/domain/language/align";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import { lineTranslations, withLanguages } from "@/domain/language/line-languages";
import { wholeLineSegments } from "@/domain/language/manual-segments";
import type { LanguagePieces, LineLanguage, LineTranslations } from "insync/language";
import { keyedPieces } from "@/domain/language/pieces";
import { normalizeTransliterationForEditing } from "@/domain/language/transliteration-format";
import type { LyricLine } from "insync/line";
import { backgroundText, lineText } from "insync/line-text";
import { roleWords } from "insync/line-track";
import type { WordTiming } from "insync/word-timing";
import { parseTtmlTimestamp } from "@/utils/lyrics-parsers/ttml-helpers";
import { ownLanguage, readInlineAlternates } from "@/utils/lyrics-parsers/ttml-modelled";

const ITUNES_NS = "http://music.apple.com/lyric-ttml-internal";
const TTM_NS = "http://www.w3.org/ns/ttml#metadata";

const directChildren = (element: Element, name: string) =>
  Array.from(element.children).filter((child) => child.localName === name);
const role = (element: Element) => element.getAttribute("ttm:role") || element.getAttributeNS(TTM_NS, "role");
const languageOf = (element: Element, fallback: string) => ownLanguage(element) || fallback;

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

function mappedPiecesFromSpans(words: WordTiming[] | undefined, text: string, spans: Element[]): LanguagePieces | null {
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

  return (
    keyedPieces(
      words,
      fragments.map((fragment, index) => ({
        text: fragment,
        ...(index < words.length - 1 ? { joinerAfter: joiners[index] } : {}),
      })),
    ) ?? null
  );
}

function parseTranslations(root: Element, lines: LyricLine[], lineIndexByKey: Map<string, number>, splitChar: string) {
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
      const translatedBackground = sidecarBackground?.textContent?.trim() || undefined;
      const translation: LineLanguage = {
        language,
        main: { text: textWithoutBackground(textElement) },
        ...(translatedBackground !== undefined && { bg: { text: translatedBackground } }),
        origin: "import",
        sourceFingerprint: languageSourceFingerprint(
          splitChar,
          lineText(line, splitChar),
          backgroundText(line, splitChar),
        ),
      };
      lines[index] = {
        ...line,
        ...withLanguages(line, { translations: { ...lineTranslations(line), [language]: translation } }),
      };
    }
  }
}

// A romanization read from a file, its readings mapped onto syllables when timed spans spell them.
function withTransliteration(
  line: LyricLine,
  language: string,
  text: string,
  romanBackground: string | undefined,
  spans: { main: Element[]; bg: Element[] },
  splitChar: string,
): LyricLine {
  const sourceBackground = backgroundText(line, splitChar);
  const mainPieces = mappedPiecesFromSpans(roleWords(line, "main"), text, spans.main);
  const backgroundPieces = romanBackground
    ? mappedPiecesFromSpans(roleWords(line, "bg"), romanBackground, spans.bg)
    : null;
  const backgroundSegments =
    romanBackground && sourceBackground ? wholeLineSegments(sourceBackground, romanBackground) : undefined;
  const track: LineLanguage = {
    language,
    main: { text, segments: wholeLineSegments(lineText(line, splitChar), text) },
    ...(romanBackground !== undefined && {
      bg: { text: romanBackground, ...(backgroundSegments && { segments: backgroundSegments }) },
    }),
    origin: "import",
    sourceFingerprint: languageSourceFingerprint(splitChar, lineText(line, splitChar), sourceBackground),
  };
  const mapped: LineLanguage = {
    ...track,
    main: { ...track.main, ...(mainPieces && { pieces: mainPieces }) },
    ...(track.bg && { bg: { ...track.bg, ...(backgroundPieces && { pieces: backgroundPieces }) } }),
  };
  const mappedLine = { ...line, ...withLanguages(line, { transliteration: mapped }) };
  return { ...mappedLine, ...alignTrackToLine(mappedLine, track, splitChar) };
}

function parseTransliterations(
  root: Element,
  lines: LyricLine[],
  lineIndexByKey: Map<string, number>,
  splitChar: string,
) {
  const transliterations = directChildren(root, "transliterations")[0];
  if (!transliterations) return;
  for (const container of directChildren(transliterations, "transliteration")) {
    const language = languageOf(container, "und-Latn");
    for (const textElement of directChildren(container, "text")) {
      const key = textElement.getAttribute("for");
      const index = key ? lineIndexByKey.get(key) : undefined;
      if (index === undefined) continue;
      const background =
        Array.from(textElement.getElementsByTagName("span")).find((span) => role(span) === "x-bg") ?? null;
      const text = decodeTransliterationText(textWithoutBackground(textElement));
      const romanBackground = background
        ? decodeTransliterationText(background.textContent ?? "") || undefined
        : undefined;
      lines[index] = withTransliteration(
        lines[index],
        language,
        text,
        romanBackground,
        {
          main: directTimedSpans(textElement),
          bg: background ? directTimedSpans(background) : [],
        },
        splitChar,
      );
    }
  }
}

// -- Inline -------------------------------------------------------------------

// The text of each inline span of a role the reader takes from a container, by language.
function inlineTexts(container: Element | null, wantedRole: string): Map<string, string> {
  const texts = new Map<string, string>();
  for (const [span, language] of container ? readInlineAlternates(container) : []) {
    const text = span.textContent?.trim();
    if (role(span) === wantedRole && text) texts.set(language, text);
  }
  return texts;
}

// Inline translations and romanization of a `<p>` and its x-bg container; a `<head>` entry read later wins.
function withInlineAlternates(
  line: LyricLine,
  paragraph: Element,
  background: Element | null,
  splitChar: string,
): LyricLine {
  const main = inlineTexts(paragraph, "x-translation");
  const bg = inlineTexts(background, "x-translation");
  const translations: LineTranslations = {};
  for (const language of new Set([...main.keys(), ...bg.keys()])) {
    const bgText = bg.get(language);
    translations[language] = {
      language,
      main: { text: main.get(language) ?? "" },
      ...(bgText !== undefined && { bg: { text: bgText } }),
      origin: "import",
      sourceFingerprint: languageSourceFingerprint(
        splitChar,
        lineText(line, splitChar),
        backgroundText(line, splitChar),
      ),
    };
  }
  const withTranslations = main.size + bg.size > 0 ? { ...line, ...withLanguages(line, { translations }) } : line;
  const romanMain = inlineTexts(paragraph, "x-roman");
  const romanBg = inlineTexts(background, "x-roman");
  const [romanLanguage] = [...romanMain.keys(), ...romanBg.keys()];
  if (romanLanguage === undefined) return withTranslations;
  const text = decodeTransliterationText(romanMain.get(romanLanguage) ?? "");
  const romanBackground = romanBg.has(romanLanguage)
    ? decodeTransliterationText(romanBg.get(romanLanguage) ?? "") || undefined
    : undefined;
  return withTransliteration(withTranslations, romanLanguage, text, romanBackground, { main: [], bg: [] }, splitChar);
}

function parseTtmlAlternates(
  doc: Document,
  lines: LyricLine[],
  lineIndexByKey: Map<string, number>,
  splitChar: string,
): void {
  const root =
    doc.getElementsByTagName("iTunesMetadata")[0] ?? doc.getElementsByTagNameNS(ITUNES_NS, "iTunesMetadata")[0];
  if (!root) return;
  parseTranslations(root, lines, lineIndexByKey, splitChar);
  parseTransliterations(root, lines, lineIndexByKey, splitChar);
}

export { parseTtmlAlternates, withInlineAlternates };
