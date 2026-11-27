// Spanish, Portuguese (Brazilian), French and Italian number words, written
// as each language's reader expects to read them. Whole numbers under a million.

// -- Types --------------------------------------------------------------------

/** The words of a whole number under a million. */
type Speller = (n: number) => string[];

// -- Constants ----------------------------------------------------------------

const words = (text: string) => text.split(" ");

const ES_SMALL = words(
  "cero uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciséis diecisiete dieciocho diecinueve veinte veintiuno veintidós veintitrés veinticuatro veinticinco veintiséis veintisiete veintiocho veintinueve",
);
const ES_TENS = words("- - - treinta cuarenta cincuenta sesenta setenta ochenta noventa");
const ES_HUNDREDS = words(
  "- ciento doscientos trescientos cuatrocientos quinientos seiscientos setecientos ochocientos novecientos",
);

const PT_SMALL = words(
  "zero um dois três quatro cinco seis sete oito nove dez onze doze treze catorze quinze dezesseis dezessete dezoito dezenove",
);
const PT_TENS = words("- - vinte trinta quarenta cinquenta sessenta setenta oitenta noventa");
const PT_HUNDREDS = words(
  "- cento duzentos trezentos quatrocentos quinhentos seiscentos setecentos oitocentos novecentos",
);

const FR_SMALL = words(
  "zéro un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize dix-sept dix-huit dix-neuf",
);
// "soixante" is spelled as it sounds: the reader has x as "ks".
const FR_TENS = words("- - vingt trente quarante cinquante soissante");

const IT_SMALL = words(
  "zero uno due tre quattro cinque sei sette otto nove dieci undici dodici tredici quattordici quindici sedici diciassette diciotto diciannove",
);
const IT_TENS = words("- - venti trenta quaranta cinquanta sessanta settanta ottanta novanta");

// -- Functions ----------------------------------------------------------------

// Thousands, then the rest: `one` is how a single thousand is said, `many` names the word after a count.
function withThousands(belowThousand: Speller, one: string[], many: string, link: (rest: number) => string[]): Speller {
  return (n) => {
    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;
    if (!thousands) return belowThousand(rest);
    const head = thousands === 1 ? one : [...belowThousand(thousands), many];
    return rest ? [...head, ...link(rest), ...belowThousand(rest)] : head;
  };
}

const noLink = () => [];

function spanishBelowThousand(n: number): string[] {
  if (n === 100) return ["cien"];
  const rest = n % 100;
  const hundreds = n >= 100 ? [ES_HUNDREDS[Math.floor(n / 100)]] : [];
  if (rest === 0 && n > 0) return hundreds;
  if (rest < 30) return [...hundreds, ES_SMALL[rest]];
  return [...hundreds, ES_TENS[Math.floor(rest / 10)], ...(rest % 10 ? ["y", ES_SMALL[rest % 10]] : [])];
}

function portugueseBelowThousand(n: number): string[] {
  if (n === 100) return ["cem"];
  const rest = n % 100;
  const out = n >= 100 ? [PT_HUNDREDS[Math.floor(n / 100)]] : [];
  if (rest === 0 && n > 0) return out;
  if (out.length > 0) out.push("e");
  if (rest < 20) return [...out, PT_SMALL[rest]];
  return [...out, PT_TENS[Math.floor(rest / 10)], ...(rest % 10 ? ["e", PT_SMALL[rest % 10]] : [])];
}

// "e" joins the thousands to a rest under a hundred or a round hundred: "mil e um", "mil e cem".
const portugueseLink = (rest: number) => (rest < 100 || rest % 100 === 0 ? ["e"] : []);

function frenchBelowHundred(n: number): string[] {
  if (n < 20) return [FR_SMALL[n]];
  // Seventy is sixty-ten and ninety is four-twenties-ten; eighty-one drops the "et".
  const base = n < 60 ? Math.floor(n / 10) * 10 : n < 80 ? 60 : 80;
  const tens = base === 80 ? ["quatre", n === 80 ? "vingts" : "vingt"] : [FR_TENS[base / 10]];
  const rest = n - base;
  if (rest === 0) return tens;
  const joined = base !== 80 && (rest === 1 || rest === 11) ? ["et"] : [];
  return [...tens, ...joined, FR_SMALL[rest]];
}

function frenchBelowThousand(n: number): string[] {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (!hundreds) return frenchBelowHundred(rest);
  const head = [...(hundreds > 1 ? [FR_SMALL[hundreds]] : []), hundreds > 1 && !rest ? "cents" : "cent"];
  return rest ? [...head, ...frenchBelowHundred(rest)] : head;
}

function italianBelowHundred(n: number): string[] {
  if (n < 20) return [IT_SMALL[n]];
  const tens = IT_TENS[Math.floor(n / 10)];
  const unit = n % 10;
  if (unit === 0) return [tens];
  // The tens lose their last vowel before "uno" and "otto": "ventuno", "ventotto".
  return [`${unit === 1 || unit === 8 ? tens.slice(0, -1) : tens}${IT_SMALL[unit]}`];
}

function italianBelowThousand(n: number): string[] {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const head = hundreds ? [...(hundreds > 1 ? [IT_SMALL[hundreds]] : []), "cento"] : [];
  return rest || !hundreds ? [...head, ...italianBelowHundred(rest)] : head;
}

const spanishNumber = withThousands(spanishBelowThousand, ["mil"], "mil", noLink);
const portugueseNumber = withThousands(portugueseBelowThousand, ["mil"], "mil", portugueseLink);
const frenchNumber = withThousands(frenchBelowThousand, ["mille"], "mille", noLink);
const italianNumber = withThousands(italianBelowThousand, ["mille"], "mila", noLink);

// -- Exports ------------------------------------------------------------------

export {
  ES_SMALL,
  FR_SMALL,
  IT_SMALL,
  PT_SMALL,
  frenchNumber,
  italianNumber,
  portugueseNumber,
  spanishNumber,
  withThousands,
};
export type { Speller };
