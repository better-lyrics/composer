import type { XmlReadElement, XmlReadNode } from "insync/ttml/xml-read-tree";

// -- Types --------------------------------------------------------------------

type XmlTreeAttr = readonly [name: string, value: string, namespaceURI: string | null];

interface XmlTreeElement {
  readonly name: string;
  readonly namespaceURI: string | null;
  readonly attrs: readonly XmlTreeAttr[];
  readonly children: readonly XmlTreeNode[];
}

interface XmlTreeCharacters {
  readonly kind: "text" | "cdata" | "comment";
  readonly text: string;
}

type XmlTreeNode = XmlTreeElement | XmlTreeCharacters;

// -- DOM ----------------------------------------------------------------------

// The tree the browser's DOMParser builds, in the shape both readers are compared in. Processing instructions are
// left out: the reader never reads them.
function xmlTreeFromDom(element: Element): XmlTreeElement {
  return {
    name: element.tagName,
    namespaceURI: element.namespaceURI,
    attrs: Array.from(element.attributes).map((attr) => [attr.name, attr.value, attr.namespaceURI] as const),
    children: Array.from(element.childNodes).flatMap((child): XmlTreeNode[] => {
      if (child.nodeType === Node.ELEMENT_NODE) return [xmlTreeFromDom(child as Element)];
      if (child.nodeType === Node.TEXT_NODE) return [{ kind: "text", text: child.textContent ?? "" }];
      if (child.nodeType === Node.CDATA_SECTION_NODE) return [{ kind: "cdata", text: child.textContent ?? "" }];
      if (child.nodeType === Node.COMMENT_NODE) return [{ kind: "comment", text: child.textContent ?? "" }];
      return [];
    }),
  };
}

// -- Parser -------------------------------------------------------------------

function xmlTreeFromRead(element: XmlReadElement): XmlTreeElement {
  return {
    name: element.tagName,
    namespaceURI: element.namespaceURI,
    attrs: element.attributes.map((attr) => [attr.name, attr.value, attr.namespaceURI] as const),
    children: element.childNodes.map(
      (child: XmlReadNode): XmlTreeNode =>
        child.kind === "element" ? xmlTreeFromRead(child) : { kind: child.kind, text: child.text },
    ),
  };
}

// -- Exports ------------------------------------------------------------------

export { xmlTreeFromDom, xmlTreeFromRead };
