import type { XmlAttr, XmlChild, XmlElement } from "../xml-node";

// -- Types --------------------------------------------------------------------

interface XmlReadAttr {
  readonly name: string;
  readonly value: string;
  readonly prefix: string | null;
  readonly localName: string;
  readonly namespaceURI: string | null;
}

interface XmlReadCharacters {
  readonly kind: "text" | "cdata" | "comment";
  readonly text: string;
}

type XmlReadNode = XmlReadElement | XmlReadCharacters;

// -- Constants ----------------------------------------------------------------

const documentOfRoot = new WeakMap<XmlReadElement, XmlReadDocument>();

// -- Elements -----------------------------------------------------------------

// A read element with the DOM reads the TTML reader makes: qualified names as written, namespaces resolved by URI.
class XmlReadElement {
  readonly kind = "element";
  readonly childNodes: XmlReadNode[] = [];
  readonly children: XmlReadElement[] = [];

  constructor(
    readonly tagName: string,
    readonly prefix: string | null,
    readonly localName: string,
    readonly namespaceURI: string | null,
    readonly attributes: readonly XmlReadAttr[],
    readonly parentElement: XmlReadElement | null,
  ) {}

  getAttribute(name: string): string | null {
    return this.attributes.find((attr) => attr.name === name)?.value ?? null;
  }

  getAttributeNS(namespaceURI: string, localName: string): string | null {
    return (
      this.attributes.find((attr) => attr.namespaceURI === namespaceURI && attr.localName === localName)?.value ?? null
    );
  }

  hasAttribute(name: string): boolean {
    return this.attributes.some((attr) => attr.name === name);
  }

  get textContent(): string {
    return this.childNodes
      .map((child) => (child.kind === "element" ? child.textContent : child.kind === "comment" ? "" : child.text))
      .join("");
  }

  // Descendants in document order, not the element itself.
  getElementsByTagName(name: string): XmlReadElement[] {
    return this.descendants((element) => element.tagName === name);
  }

  getElementsByTagNameNS(namespaceURI: string, localName: string): XmlReadElement[] {
    return this.descendants((element) => element.namespaceURI === namespaceURI && element.localName === localName);
  }

  get ownerDocument(): XmlReadDocument {
    let root: XmlReadElement = this;
    while (root.parentElement) root = root.parentElement;
    const doc = documentOfRoot.get(root);
    if (!doc) throw new Error("a read element outside any read document");
    return doc;
  }

  contains(other: XmlReadElement): boolean {
    for (let at: XmlReadElement | null = other; at; at = at.parentElement) if (at === this) return true;
    return false;
  }

  descendants(test: (element: XmlReadElement) => boolean, found: XmlReadElement[] = []): XmlReadElement[] {
    for (const child of this.children) {
      if (test(child)) found.push(child);
      child.descendants(test, found);
    }
    return found;
  }
}

class XmlReadDocument {
  constructor(readonly documentElement: XmlReadElement) {
    documentOfRoot.set(documentElement, this);
  }

  getElementsByTagName(name: string): XmlReadElement[] {
    return this.withRoot((element) => element.tagName === name);
  }

  getElementsByTagNameNS(namespaceURI: string, localName: string): XmlReadElement[] {
    return this.withRoot((element) => element.namespaceURI === namespaceURI && element.localName === localName);
  }

  // The first element, the root included, holding an attribute with this value.
  firstWithAttribute(name: string, value: string): XmlReadElement | undefined {
    return this.withRoot((element) => element.getAttribute(name) === value)[0];
  }

  private withRoot(test: (element: XmlReadElement) => boolean): XmlReadElement[] {
    const root = this.documentElement;
    return root.descendants(test, test(root) ? [root] : []);
  }
}

// -- Stored -------------------------------------------------------------------

// Indentation between elements is layout, not content; a space between inline elements is content.
function isIndentation(text: string): boolean {
  return text.trim() === "" && text.includes("\n");
}

function storedAttrs(element: XmlReadElement, keep: (attr: XmlReadAttr) => boolean = () => true): XmlAttr[] {
  return element.attributes.flatMap((attr) => (keep(attr) ? [[attr.name, attr.value] as const] : []));
}

// Comments are not kept.
function storedChildren(element: XmlReadElement): XmlChild[] {
  return element.childNodes.flatMap((child): XmlChild[] => {
    if (child.kind === "element") return [storedElement(child)];
    if (child.kind === "comment") return [];
    return isIndentation(child.text) ? [] : [{ text: child.text }];
  });
}

function storedElement(element: XmlReadElement): XmlElement {
  return { name: element.tagName, attrs: storedAttrs(element), children: storedChildren(element) };
}

// -- Exports ------------------------------------------------------------------

export type { XmlReadAttr, XmlReadCharacters, XmlReadNode };
export { storedAttrs, storedChildren, storedElement, XmlReadDocument, XmlReadElement };
