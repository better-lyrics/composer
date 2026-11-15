import { XMLValidator } from "fast-xml-parser";

// -- Constants ----------------------------------------------------------------

const FALLBACK_MESSAGE = "the document is not well-formed";

// -- Functions ----------------------------------------------------------------

// Why the source is not well-formed XML, or null when the validator accepts it. The reader checks what the
// validator lets through (one root, entities, namespaces) while it builds the tree.
function xmlWellFormednessError(source: string): string | null {
  const result = XMLValidator.validate(source);
  if (result === true) return null;
  return result.err.msg || FALLBACK_MESSAGE;
}

// -- Exports ------------------------------------------------------------------

export { xmlWellFormednessError };
