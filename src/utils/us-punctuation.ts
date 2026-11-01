const US_PUNCTUATION_BY_CODE: Record<string, [base: string, shifted: string]> = {
  Backquote: ["`", "~"],
  Minus: ["-", "_"],
  Equal: ["=", "+"],
  BracketLeft: ["[", "{"],
  BracketRight: ["]", "}"],
  Backslash: ["\\", "|"],
  Semicolon: [";", ":"],
  Quote: ["'", '"'],
  Comma: [",", "<"],
  Period: [".", ">"],
  Slash: ["/", "?"],
};

const US_SHIFTED_BY_BASE = new Map(Object.values(US_PUNCTUATION_BY_CODE));

function shiftedUsPunctuation(base: string): string | undefined {
  return US_SHIFTED_BY_BASE.get(base);
}

export { US_PUNCTUATION_BY_CODE, shiftedUsPunctuation };
