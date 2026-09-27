import { parseXmlDocument } from "@/utils/xml-document";

type TtmlValidation = { ok: true } | { ok: false; message: string };

function validateTtml(xml: string): TtmlValidation {
  const parsed = parseXmlDocument(xml);
  return parsed.ok ? { ok: true } : parsed;
}

export { validateTtml };
