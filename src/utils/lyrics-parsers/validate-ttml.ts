type XmlParseResult = { ok: true; doc: Document } | { ok: false; message: string };
type TtmlValidation = { ok: true } | { ok: false; message: string };

const FALLBACK_MESSAGE = "the document is not well-formed";

function firstLineOf(parseError: Element): string {
  // Chromium wraps the message in a div between two explanatory headings.
  const text = (parseError.querySelector("div") ?? parseError).textContent ?? "";
  const line = text
    .split("\n")
    .map((part) => part.trim())
    .find((part) => part !== "");
  return line ?? FALLBACK_MESSAGE;
}

function parseXmlDocument(xml: string): XmlParseResult {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const parseError = doc.querySelector("parsererror");
  return parseError ? { ok: false, message: firstLineOf(parseError) } : { ok: true, doc };
}

function validateTtml(xml: string): TtmlValidation {
  const parsed = parseXmlDocument(xml);
  return parsed.ok ? { ok: true } : parsed;
}

export { parseXmlDocument, validateTtml };
