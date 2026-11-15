import type { XmlAttr, XmlChild, XmlElement } from "insync/xml-node";

// -- Helpers ------------------------------------------------------------------

// Indentation between elements is layout, not content; a space between inline elements is content.
function isIndentation(text: string): boolean {
  return text.trim() === "" && text.includes("\n");
}

// -- Functions ----------------------------------------------------------------

function xmlAttrsFromDom(element: Element, keep: (attr: Attr) => boolean = () => true): XmlAttr[] {
  return Array.from(element.attributes).flatMap((attr) => (keep(attr) ? [[attr.name, attr.value] as const] : []));
}

// Comments and processing instructions are not kept.
function xmlChildrenFromDom(node: Node): XmlChild[] {
  return Array.from(node.childNodes).flatMap((child): XmlChild[] => {
    if (child.nodeType === Node.ELEMENT_NODE) return [xmlElementFromDom(child as Element)];
    if (child.nodeType !== Node.TEXT_NODE && child.nodeType !== Node.CDATA_SECTION_NODE) return [];
    const text = child.textContent ?? "";
    return isIndentation(text) ? [] : [{ text }];
  });
}

function xmlElementFromDom(element: Element): XmlElement {
  return { name: element.tagName, attrs: xmlAttrsFromDom(element), children: xmlChildrenFromDom(element) };
}

// -- Exports ------------------------------------------------------------------

export { xmlAttrsFromDom, xmlChildrenFromDom, xmlElementFromDom };
