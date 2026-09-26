const DASH_CHARACTERS = new Set(["-", "\u2010", "\u2011", "\u2012", "\u2013", "\u2014", "\u2015"]);

function isWhitespaceSeparator(char: string): boolean {
  return char.length > 0 && char.trim().length === 0;
}

function isDashSeparator(char: string): boolean {
  return DASH_CHARACTERS.has(char);
}

function isUntimedSeparator(char: string): boolean {
  return isWhitespaceSeparator(char) || isDashSeparator(char);
}

function normalizeSplitPointAtSeparator(text: string, point: number): number {
  let normalized = point;
  while (normalized < text.length && isUntimedSeparator(text[normalized])) normalized++;
  return normalized;
}

export { isDashSeparator, isWhitespaceSeparator, normalizeSplitPointAtSeparator };
