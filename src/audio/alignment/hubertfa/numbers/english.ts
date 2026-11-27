// English number words. A lyric's four-digit number is nearly always a year,
// said in pairs ("nineteen ninety-nine"); "1st" and "90s" keep their endings.

// -- Constants ----------------------------------------------------------------

const SMALL =
  "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(
    " ",
  );
const TENS = "- - twenty thirty forty fifty sixty seventy eighty ninety".split(" ");
const IRREGULAR_ORDINALS: Readonly<Record<string, string>> = {
  one: "first",
  two: "second",
  three: "third",
  five: "fifth",
  eight: "eighth",
  nine: "ninth",
  twelve: "twelfth",
};
// How a digit is said when a number is read out digit by digit ("eight six seven five three oh nine").
const ENGLISH_DIGITS = "oh one two three four five six seven eight nine".split(" ");

// -- Functions ----------------------------------------------------------------

function belowHundred(n: number): string[] {
  if (n < 20) return [SMALL[n]];
  return n % 10 === 0 ? [TENS[n / 10]] : [TENS[Math.floor(n / 10)], SMALL[n % 10]];
}

function belowThousand(n: number): string[] {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [...(hundreds ? [SMALL[hundreds], "hundred"] : []), ...(rest || !hundreds ? belowHundred(rest) : [])];
}

/** The words of a whole number under a million. */
function englishCardinal(n: number): string[] {
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  return [
    ...(thousands ? [...belowThousand(thousands), "thousand"] : []),
    ...(rest || !thousands ? belowThousand(rest) : []),
  ];
}

/** A year said in pairs, or null for a number that isn't said that way (2000 to 2009 are "two thousand five"). */
function englishYear(n: number): string[] | null {
  if (n < 1100 || n > 2099 || (n >= 2000 && n < 2010)) return null;
  const century = belowHundred(Math.floor(n / 100));
  const rest = n % 100;
  if (rest === 0) return [...century, "hundred"];
  return [...century, ...(rest < 10 ? ["oh"] : []), ...belowHundred(rest)];
}

/** "twenty one" to "twenty first". */
function englishOrdinal(words: readonly string[]): string[] {
  const last = words[words.length - 1];
  const ordinal = IRREGULAR_ORDINALS[last] ?? (last.endsWith("y") ? `${last.slice(0, -1)}ieth` : `${last}th`);
  return [...words.slice(0, -1), ordinal];
}

/** "nineteen ninety" to "nineteen nineties". */
function englishPlural(words: readonly string[]): string[] {
  const last = words[words.length - 1];
  const plural = last.endsWith("y") ? `${last.slice(0, -1)}ies` : last.endsWith("x") ? `${last}es` : `${last}s`;
  return [...words.slice(0, -1), plural];
}

// -- Exports ------------------------------------------------------------------

export { ENGLISH_DIGITS, englishCardinal, englishOrdinal, englishPlural, englishYear };
