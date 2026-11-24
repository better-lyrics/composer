// -- Types --------------------------------------------------------------------

// Songwriters are people; artists can be acts whose names read like lists ("Simon & Garfunkel").
type CreditKind = "people" | "acts";

// -- Constants ----------------------------------------------------------------

const CREDIT_LIST_SEPARATOR_REGEX = /[,;\n，、；]/;

// Separators no act puts in its name, unlike the comma in "Tyler, The Creator".
const CREDIT_LIST_HARD_SEPARATOR_REGEX = /[;\n、；]/;

// "and" or "&" opening or inside the last item of a list: "B, and C" or "B & C".
const CREDIT_LIST_CONJUNCTION_REGEX = /(?:^|\s+)(?:and|&)\s+/i;

// -- Functions ----------------------------------------------------------------

function isCreditList(text: string, items: string[], lastItemParts: string[], kind: CreditKind): boolean {
  if (CREDIT_LIST_HARD_SEPARATOR_REGEX.test(text) || items.length >= 3) return true;
  if (lastItemParts.length < 2) return false;
  return items.length === 2 || kind === "people";
}

// Splits pasted credits like "A, B, and C" into one name each. A single name comes back whole.
function splitCreditList(text: string, kind: CreditKind): string[] {
  const items = text.split(CREDIT_LIST_SEPARATOR_REGEX);
  const lastItemParts = (items.at(-1) ?? "").split(CREDIT_LIST_CONJUNCTION_REGEX);
  const names = isCreditList(text, items, lastItemParts, kind) ? [...items.slice(0, -1), ...lastItemParts] : [text];
  return names.map((name) => name.trim()).filter((name) => name.length > 0);
}

// -- Exports ------------------------------------------------------------------

export { splitCreditList };
export type { CreditKind };
