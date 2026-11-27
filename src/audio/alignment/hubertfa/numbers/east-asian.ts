// Korean, Japanese and Mandarin number readings. Whole numbers under a million.
// Korean comes out in Hangul for its reader, Japanese in kana and Mandarin as
// toneless pinyin syllables, which are what their dictionaries are keyed by.

// -- Constants ----------------------------------------------------------------

const KO_DIGITS = [..."영일이삼사오육칠팔구"];
const KO_UNITS: ReadonlyArray<readonly [number, string]> = [
  [1000, "천"],
  [100, "백"],
  [10, "십"],
];
// Native numbers, in the form they take before a counter: "열일곱 살", "스무 살".
const KO_NATIVE_ONES = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉"];
const KO_NATIVE_TENS = ["", "열", "스물", "서른", "마흔", "쉰", "예순", "일흔", "여든", "아흔"];
// Counters that take native numbers: age, hours, things, people, times, animals, drinks, books, months, kinds, songs.
const KO_NATIVE_COUNTERS = ["살", "시", "개", "명", "번", "마리", "잔", "병", "권", "달", "가지", "사람", "장", "곡"];

const JA_DIGITS = ["ゼロ", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう"];
// The readings a digit and its unit fuse into: 300 is "sanbyaku", 8,000 "hassen".
const JA_FUSED: Readonly<Record<string, string>> = {
  "3ひゃく": "さんびゃく",
  "6ひゃく": "ろっぴゃく",
  "8ひゃく": "はっぴゃく",
  "3せん": "さんぜん",
  "8せん": "はっせん",
};
const JA_UNITS: ReadonlyArray<readonly [number, string]> = [
  [1000, "せん"],
  [100, "ひゃく"],
  [10, "じゅう"],
];

const ZH_DIGITS = "ling yi er san si wu liu qi ba jiu".split(" ");
const ZH_UNITS: ReadonlyArray<readonly [number, string]> = [
  [1000, "qian"],
  [100, "bai"],
  [10, "shi"],
];

// -- Functions ----------------------------------------------------------------

// A one before ten, a hundred or a thousand isn't said: 십, 백, 천.
function koreanBelowTenThousand(n: number): string {
  let out = "";
  for (const [unit, name] of KO_UNITS) {
    const digit = Math.floor(n / unit) % 10;
    if (digit) out += `${digit > 1 ? KO_DIGITS[digit] : ""}${name}`;
  }
  return n % 10 ? out + KO_DIGITS[n % 10] : out;
}

/** Sino-Korean, the reading for dates, money, minutes and plain numbers. */
function koreanNumber(n: number): string[] {
  if (n === 0) return [KO_DIGITS[0]];
  const myriads = Math.floor(n / 10000);
  const head = myriads ? `${myriads > 1 ? koreanBelowTenThousand(myriads) : ""}만` : "";
  return [head + koreanBelowTenThousand(n % 10000)];
}

/** The native reading of 1 to 99 when `after`, the text that follows the digits, starts with a counter that takes it. */
function koreanNative(n: number, after: string): string[] | null {
  if (n < 1 || n > 99 || !KO_NATIVE_COUNTERS.some((counter) => after.startsWith(counter))) return null;
  if (n === 20) return ["스무"];
  return [KO_NATIVE_TENS[Math.floor(n / 10)] + KO_NATIVE_ONES[n % 10]];
}

function japaneseBelowTenThousand(n: number): string {
  let out = "";
  for (const [unit, name] of JA_UNITS) {
    const digit = Math.floor(n / unit) % 10;
    if (digit) out += JA_FUSED[`${digit}${name}`] ?? `${digit > 1 ? JA_DIGITS[digit] : ""}${name}`;
  }
  return n % 10 ? out + JA_DIGITS[n % 10] : out;
}

/** Kana for a number, without the sound changes a counter after it can bring. */
function japaneseNumber(n: number): string[] {
  if (n === 0) return [JA_DIGITS[0]];
  const myriads = Math.floor(n / 10000);
  // Ten thousand keeps its one: "ichiman".
  const head = myriads ? `${japaneseBelowTenThousand(myriads)}まん` : "";
  return [head + japaneseBelowTenThousand(n % 10000)];
}

// `ling` stands for the places skipped inside a number (101 is "yi bai ling yi"); a number that starts at ten
// drops its one ("shi qi"); two thousand is "liang qian".
function mandarinBelowTenThousand(n: number, inside: boolean): string[] {
  const out: string[] = [];
  let started = inside;
  let skipped = inside && n < 1000;
  for (const [unit, name] of ZH_UNITS) {
    const digit = Math.floor(n / unit) % 10;
    if (digit === 0) {
      skipped ||= started;
      continue;
    }
    if (skipped) out.push("ling");
    skipped = false;
    if (unit === 1000 && digit === 2) out.push("liang");
    else if (unit !== 10 || digit !== 1 || started) out.push(ZH_DIGITS[digit]);
    out.push(name);
    started = true;
  }
  if (n % 10) out.push(...(skipped ? ["ling"] : []), ZH_DIGITS[n % 10]);
  return out;
}

/** Toneless pinyin syllables. A year (1100 to 2099) is read digit by digit, as years are. */
function mandarinNumber(n: number): string[] {
  if (n === 0) return [ZH_DIGITS[0]];
  if (n >= 1100 && n <= 2099) return [...String(n)].map((digit) => ZH_DIGITS[Number(digit)]);
  const myriads = Math.floor(n / 10000);
  const rest = n % 10000;
  if (!myriads) return mandarinBelowTenThousand(rest, false);
  const head = [...(myriads === 2 ? ["liang"] : mandarinBelowTenThousand(myriads, false)), "wan"];
  return rest ? [...head, ...mandarinBelowTenThousand(rest, true)] : head;
}

// -- Exports ------------------------------------------------------------------

export { JA_DIGITS, KO_DIGITS, ZH_DIGITS, japaneseNumber, koreanNative, koreanNumber, mandarinNumber };
