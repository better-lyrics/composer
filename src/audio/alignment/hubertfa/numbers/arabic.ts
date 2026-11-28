// Arabic number words in their Modern Standard forms, written without vowel
// marks as lyrics are. Sung Arabic is mostly dialect, whose numbers are close
// but not the same ("سبعتاشر" for 17), so these are a best guess. Whole numbers
// under a million.

// -- Constants ----------------------------------------------------------------

const AR_ONES = ["صفر", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة"];
const AR_TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const AR_HUNDREDS = ["", "مئة", "مئتان", "ثلاثمئة", "أربعمئة", "خمسمئة", "ستمئة", "سبعمئة", "ثمانمئة", "تسعمئة"];
const AND = "و";

// -- Functions ----------------------------------------------------------------

// Each group after the first is joined on with "and", written onto its first word.
function joined(groups: readonly string[][]): string[] {
  return groups
    .filter((group) => group.length > 0)
    .flatMap((group, i) => (i === 0 ? group : [AND + group[0], ...group.slice(1)]));
}

function belowHundred(n: number): string[][] {
  if (n === 0) return [];
  if (n <= 10) return [[AR_ONES[n]]];
  if (n === 11) return [["أحد", "عشر"]];
  if (n === 12) return [["اثنا", "عشر"]];
  if (n < 20) return [[AR_ONES[n - 10], "عشر"]];
  // The unit comes first: "one and twenty".
  return [n % 10 ? [AR_ONES[n % 10]] : [], [AR_TENS[Math.floor(n / 10)]]];
}

function belowThousand(n: number): string[][] {
  return [n >= 100 ? [AR_HUNDREDS[Math.floor(n / 100)]] : [], ...belowHundred(n % 100)];
}

function thousands(count: number): string[] {
  if (count === 1) return ["ألف"];
  if (count === 2) return ["ألفان"];
  if (count <= 10) return [AR_ONES[count], "آلاف"];
  return [...joined(belowThousand(count)), "ألف"];
}

function arabicNumber(n: number): string[] {
  if (n === 0) return [AR_ONES[0]];
  const count = Math.floor(n / 1000);
  return joined([count ? thousands(count) : [], ...belowThousand(n % 1000)]);
}

// -- Exports ------------------------------------------------------------------

export { AR_ONES, arabicNumber };
