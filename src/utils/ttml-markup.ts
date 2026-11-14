import type { Passthrough } from "insync/passthrough";
import { escapeXmlText, writeXmlAttrs, writeXmlChild, type XmlChild } from "insync/xml-node";
import { formatTime } from "@/utils/format-time";

// -- Constants ----------------------------------------------------------------

// Ruby annotations, not part of the lyric a span spells.
const ANNOTATION_ELEMENTS: ReadonlySet<string> = new Set(["rt", "rp"]);

// -- Markup -------------------------------------------------------------------

const localName = (name: string) => name.slice(name.indexOf(":") + 1);

// The lyric text of a span's markup, without its ruby annotations.
function markupBaseText(markup: readonly XmlChild[]): string {
  return markup
    .map((child) =>
      "text" in child
        ? child.text
        : ANNOTATION_ELEMENTS.has(localName(child.name))
          ? ""
          : markupBaseText(child.children),
    )
    .join("");
}

// Kept markup is written back while the syllable still spells it; an edited syllable writes its own text.
function spanContent(text: string, markup: readonly XmlChild[] | undefined): string {
  if (markup && markupBaseText(markup).trim() === text) return markup.map(writeXmlChild).join("");
  return escapeXmlText(text);
}

// -- Spans --------------------------------------------------------------------

// `kept` is the syllable's own TTML data; spans written for other tracks, such as romanization, pass none.
function emitWordSpan(word: { begin: number; end: number; explicit?: true }, text: string, kept?: Passthrough): string {
  const explicitAttr = word.explicit ? ' composer:explicit="true"' : "";
  const keptAttrs = kept?.attrs ? writeXmlAttrs(kept.attrs) : "";
  return `<span begin="${formatTime(word.begin)}" end="${formatTime(word.end)}"${explicitAttr}${keptAttrs}>${spanContent(text, kept?.markup)}</span>`;
}

// -- Exports ------------------------------------------------------------------

export { emitWordSpan, markupBaseText };
