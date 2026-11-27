import { type Speller, withThousands } from "@/audio/alignment/hubertfa/numbers/romance";

// German, Turkish and Indonesian (which also reads Malay) number words.
// Whole numbers under a million.

// -- Constants ----------------------------------------------------------------

const words = (text: string) => text.split(" ");

const DE_SMALL = words(
  "null eins zwei drei vier fünf sechs sieben acht neun zehn elf zwölf dreizehn vierzehn fünfzehn sechzehn siebzehn achtzehn neunzehn",
);
const DE_TENS = words("- - zwanzig dreißig vierzig fünfzig sechzig siebzig achtzig neunzig");

const TR_SMALL = words("sıfır bir iki üç dört beş altı yedi sekiz dokuz");
const TR_TENS = words("- on yirmi otuz kırk elli altmış yetmiş seksen doksan");

const ID_SMALL = words("nol satu dua tiga empat lima enam tujuh delapan sembilan");

// -- Functions ----------------------------------------------------------------

// "eins" is "ein" inside a longer number: "einundzwanzig", "einhundert".
const germanCount = (n: number) => (n === 1 ? "ein" : DE_SMALL[n]);

function germanBelowHundred(n: number): string[] {
  if (n < 20) return [DE_SMALL[n]];
  const unit = n % 10;
  return unit ? [germanCount(unit), "und", DE_TENS[Math.floor(n / 10)]] : [DE_TENS[n / 10]];
}

function germanBelowThousand(n: number): string[] {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const head = hundreds ? [germanCount(hundreds), "hundert"] : [];
  return rest || !hundreds ? [...head, ...germanBelowHundred(rest)] : head;
}

const germanCardinal = withThousands(germanBelowThousand, ["ein", "tausend"], "tausend", () => []);

/** German says the years 1100 to 1999 in hundreds: "neunzehnhundertneunundneunzig". */
const germanNumber: Speller = (n) => {
  if (n < 1100 || n > 1999) return germanCardinal(n);
  const rest = n % 100;
  return [DE_SMALL[Math.floor(n / 100)], "hundert", ...(rest ? germanBelowHundred(rest) : [])];
};

function turkishBelowThousand(n: number): string[] {
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor((n % 100) / 10);
  const unit = n % 10;
  if (n === 0) return [TR_SMALL[0]];
  return [
    // One hundred is just "yüz".
    ...(hundreds ? [...(hundreds > 1 ? [TR_SMALL[hundreds]] : []), "yüz"] : []),
    ...(tens ? [TR_TENS[tens]] : []),
    ...(unit ? [TR_SMALL[unit]] : []),
  ];
}

// "se-" stands for one before a unit word: "sepuluh", "seratus", "seribu".
const indonesianCount = (n: number, unit: string) => (n === 1 ? [`se${unit}`] : [ID_SMALL[n], unit]);

function indonesianBelowHundred(n: number): string[] {
  if (n < 10) return [ID_SMALL[n]];
  if (n === 11) return ["sebelas"];
  if (n < 20) return n === 10 ? ["sepuluh"] : [ID_SMALL[n - 10], "belas"];
  const unit = n % 10;
  return [...indonesianCount(Math.floor(n / 10), "puluh"), ...(unit ? [ID_SMALL[unit]] : [])];
}

function indonesianBelowThousand(n: number): string[] {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const head = hundreds ? indonesianCount(hundreds, "ratus") : [];
  return rest || !hundreds ? [...head, ...indonesianBelowHundred(rest)] : head;
}

const turkishNumber = withThousands(turkishBelowThousand, ["bin"], "bin", () => []);
const indonesianNumber = withThousands(indonesianBelowThousand, ["seribu"], "ribu", () => []);

// -- Exports ------------------------------------------------------------------

export { DE_SMALL, ID_SMALL, TR_SMALL, germanNumber, indonesianNumber, turkishNumber };
