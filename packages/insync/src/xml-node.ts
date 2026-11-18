// -- Types --------------------------------------------------------------------

// Qualified name as written in the source, value unescaped.
type XmlAttr = readonly [name: string, value: string];

interface XmlText {
  readonly text: string;
}

interface XmlElement {
  readonly name: string;
  readonly attrs: readonly XmlAttr[];
  readonly children: readonly XmlChild[];
}

type XmlChild = XmlElement | XmlText;

// -- Escaping -----------------------------------------------------------------

function escapeXmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

// Tabs and line breaks become character references: a parser would otherwise read them back as spaces.
function escapeXmlAttribute(value: string): string {
  return escapeXmlText(value)
    .replace(/"/g, "&quot;")
    .replace(/\t/g, "&#9;")
    .replace(/\n/g, "&#10;")
    .replace(/\r/g, "&#13;");
}

// -- Writing ------------------------------------------------------------------

function writeXmlAttrs(attrs: readonly XmlAttr[]): string {
  return attrs.map(([name, value]) => ` ${name}="${escapeXmlAttribute(value)}"`).join("");
}

function writeXmlChild(child: XmlChild): string {
  return "text" in child ? escapeXmlText(child.text) : writeXmlElement(child);
}

// Attributes in stored order; no whitespace is added between children.
function writeXmlElement(element: XmlElement): string {
  const open = `<${element.name}${writeXmlAttrs(element.attrs)}`;
  if (element.children.length === 0) return `${open}/>`;
  return `${open}>${element.children.map(writeXmlChild).join("")}</${element.name}>`;
}

// -- Exports ------------------------------------------------------------------

export type { XmlAttr, XmlChild, XmlElement };
export { escapeXmlAttribute, escapeXmlText, writeXmlAttrs, writeXmlChild, writeXmlElement };
