import type { Passthrough } from "../passthrough";
import { escapeXmlText, writeXmlAttrs, writeXmlChild, type XmlChild } from "../xml-node";
import { formatTime } from "../format-time";

// -- Constants ----------------------------------------------------------------

// Ruby annotations, not part of the lyric a span spells.
const ANNOTATION_ELEMENTS: ReadonlySet<string> = new Set(["rt", "rp"]);
const NO_ELEMENTS: ReadonlySet<string> = new Set();

// -- Markup -------------------------------------------------------------------

const localName = (name: string) => name.slice(name.indexOf(":") + 1);

function markupText(markup: readonly XmlChild[], skipped: ReadonlySet<string>): string {
  return markup
    .map((child) =>
      "text" in child ? child.text : skipped.has(localName(child.name)) ? "" : markupText(child.children, skipped),
    )
    .join("");
}

// The lyric text of a span's markup, without its ruby annotations.
function markupBaseText(markup: readonly XmlChild[]): string {
  return markupText(markup, ANNOTATION_ELEMENTS);
}

// Kept mixed content, such as a singer name holding an element, while the text it spells is still `text`.
function keptContent(text: string, markup: readonly XmlChild[] | undefined): string {
  return markup && markupText(markup, NO_ELEMENTS) === text ? markup.map(writeXmlChild).join("") : escapeXmlText(text);
}

// Kept markup is written back while the syllable still spells it; an edited syllable writes its own text.
function writesMarkup(text: string, markup: readonly XmlChild[] | undefined): markup is readonly XmlChild[] {
  return markup !== undefined && markupBaseText(markup).trim() === text;
}

function spanContent(text: string, markup: readonly XmlChild[] | undefined): string {
  return writesMarkup(text, markup) ? markup.map(writeXmlChild).join("") : escapeXmlText(text);
}

// Kept markup that already ends in a space carries the separator itself.
function spanEndsInSpace(text: string, kept: Passthrough | undefined): boolean {
  if (!writesMarkup(text, kept?.markup)) return false;
  const base = markupBaseText(kept.markup);
  return base !== base.trimEnd();
}

// -- Spans --------------------------------------------------------------------

function timedSpan(word: { begin: number; end: number; explicit?: true }, content: string, keptAttrs = ""): string {
  const explicitAttr = word.explicit ? ' composer:explicit="true"' : "";
  return `<span begin="${formatTime(word.begin)}" end="${formatTime(word.end)}"${explicitAttr}${keptAttrs}>${content}</span>`;
}

// `kept` is the syllable's own TTML data; spans written for other tracks, such as romanization, pass none.
function emitWordSpan(word: { begin: number; end: number; explicit?: true }, text: string, kept?: Passthrough): string {
  return timedSpan(word, spanContent(text, kept?.markup), kept?.attrs ? writeXmlAttrs(kept.attrs) : "");
}

// -- Exports ------------------------------------------------------------------

export { emitWordSpan, keptContent, markupBaseText, spanContent, spanEndsInSpace, timedSpan };
