import type { XmlReadElement, XmlReadNode } from "./xml-read-tree";
import type { LyricLine } from "../line";
import { elementRole, isLyricTextElement, isTimedWordSpan, LYRIC_ROLES } from "./modelled";

// -- Types --------------------------------------------------------------------

// The id a modelled child of a node stands for, which kept elements after it follow; none for the rest.
type AnchorOf = (child: XmlReadNode) => string | undefined;

// -- Constants ----------------------------------------------------------------

const HEAD_ANCHOR = "head";
const BODY_ANCHOR = "body";
// A track written whole, as the text of a line-synced line.
const TEXT_ANCHOR = "text";
const BACKGROUND_ANCHOR = "x-bg";

// -- Functions ----------------------------------------------------------------

const noAnchors: AnchorOf = () => undefined;

const asElement = (child: XmlReadNode) => (child.kind === "element" ? child : null);

const rootAnchors: AnchorOf = (child) => {
  const tagName = asElement(child)?.tagName;
  return tagName === HEAD_ANCHOR || tagName === BODY_ANCHOR ? tagName : undefined;
};

// Lines and the sections holding them stand for the line written last in them.
function sectionAnchors(lineByParagraph: ReadonlyMap<XmlReadElement, LyricLine>): AnchorOf {
  return (child) => {
    const element = asElement(child);
    if (element?.tagName === "p") return lineByParagraph.get(element)?.id;
    if (element?.tagName !== "div") return undefined;
    const paragraphs = element.getElementsByTagName("p");
    for (let index = paragraphs.length - 1; index >= 0; index--) {
      const line = lineByParagraph.get(paragraphs[index]);
      if (line) return line.id;
    }
    return undefined;
  };
}

// Timed spans stand for the syllables read from them; without any, the lyric text stands for the track as a whole.
function trackAnchors(container: XmlReadElement, timed: readonly { id: string }[], holdsBackground: boolean): AnchorOf {
  const spans = Array.from(container.children).filter(isTimedWordSpan);
  const syllableOf = new Map(spans.length === timed.length ? spans.map((span, index) => [span, timed[index].id]) : []);
  return (child) => {
    const element = asElement(child);
    if (!element)
      return spans.length === 0 && ("text" in child ? child.text : "").trim() !== "" ? TEXT_ANCHOR : undefined;
    const role = elementRole(element);
    if (holdsBackground && role === BACKGROUND_ANCHOR) return BACKGROUND_ANCHOR;
    if (spans.length > 0) return syllableOf.get(element);
    return isLyricTextElement(element) && !LYRIC_ROLES.has(role ?? "") ? TEXT_ANCHOR : undefined;
  };
}

// -- Exports ------------------------------------------------------------------

export type { AnchorOf };
export {
  BACKGROUND_ANCHOR,
  BODY_ANCHOR,
  HEAD_ANCHOR,
  noAnchors,
  rootAnchors,
  sectionAnchors,
  TEXT_ANCHOR,
  trackAnchors,
};
