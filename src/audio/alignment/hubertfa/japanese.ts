// Japanese text → the romaji mora keys HubertFA's Japanese dictionary uses
// ("ka", "shi", "kyo", "n", "cl"). Kana convert directly; kanji need a
// reading, which comes from kuromoji (IPADIC) in the worker.

// -- Types --------------------------------------------------------------------

interface ReadingToken {
  surface: string;
  /** Character offset of the token in the text it came from. */
  start: number;
  /** Katakana as sung ("ワ" for the particle は), when the tokenizer knows the word. */
  pronunciation: string | null;
}

// -- Constants ----------------------------------------------------------------

const BASE_MORAE: Record<string, string> = {
  ア: "a",
  イ: "i",
  ウ: "u",
  エ: "e",
  オ: "o",
  カ: "ka",
  キ: "ki",
  ク: "ku",
  ケ: "ke",
  コ: "ko",
  サ: "sa",
  シ: "shi",
  ス: "su",
  セ: "se",
  ソ: "so",
  タ: "ta",
  チ: "chi",
  ツ: "tsu",
  テ: "te",
  ト: "to",
  ナ: "na",
  ニ: "ni",
  ヌ: "nu",
  ネ: "ne",
  ノ: "no",
  ハ: "ha",
  ヒ: "hi",
  フ: "fu",
  ヘ: "he",
  ホ: "ho",
  マ: "ma",
  ミ: "mi",
  ム: "mu",
  メ: "me",
  モ: "mo",
  ヤ: "ya",
  ユ: "yu",
  ヨ: "yo",
  ラ: "ra",
  リ: "ri",
  ル: "ru",
  レ: "re",
  ロ: "ro",
  ワ: "wa",
  ヰ: "i",
  ヱ: "e",
  ヲ: "o",
  ン: "n",
  ガ: "ga",
  ギ: "gi",
  グ: "gu",
  ゲ: "ge",
  ゴ: "go",
  ザ: "za",
  ジ: "ji",
  ズ: "zu",
  ゼ: "ze",
  ゾ: "zo",
  ダ: "da",
  ヂ: "ji",
  ヅ: "zu",
  デ: "de",
  ド: "do",
  バ: "ba",
  ビ: "bi",
  ブ: "bu",
  ベ: "be",
  ボ: "bo",
  パ: "pa",
  ピ: "pi",
  プ: "pu",
  ペ: "pe",
  ポ: "po",
  ヴ: "vu",
  ァ: "a",
  ィ: "i",
  ゥ: "u",
  ェ: "e",
  ォ: "o",
  ャ: "ya",
  ュ: "yu",
  ョ: "yo",
  ヮ: "wa",
};

// Two-kana morae: a consonant kana plus a small vowel or small y-kana.
const COMBINED_MORAE: Record<string, string> = {
  キャ: "kya",
  キュ: "kyu",
  キョ: "kyo",
  キェ: "kye",
  ギャ: "gya",
  ギュ: "gyu",
  ギョ: "gyo",
  ギェ: "gye",
  シャ: "sha",
  シュ: "shu",
  ショ: "sho",
  シェ: "she",
  ジャ: "ja",
  ジュ: "ju",
  ジョ: "jo",
  ジェ: "je",
  チャ: "cha",
  チュ: "chu",
  チョ: "cho",
  チェ: "che",
  ヂャ: "ja",
  ヂュ: "ju",
  ヂョ: "jo",
  ニャ: "nya",
  ニュ: "nyu",
  ニョ: "nyo",
  ニェ: "nye",
  ヒャ: "hya",
  ヒュ: "hyu",
  ヒョ: "hyo",
  ヒェ: "hye",
  ビャ: "bya",
  ビュ: "byu",
  ビョ: "byo",
  ビェ: "bye",
  ピャ: "pya",
  ピュ: "pyu",
  ピョ: "pyo",
  ピェ: "pye",
  ミャ: "mya",
  ミュ: "myu",
  ミョ: "myo",
  ミェ: "mye",
  リャ: "rya",
  リュ: "ryu",
  リョ: "ryo",
  リェ: "rye",
  ファ: "fa",
  フィ: "fi",
  フェ: "fe",
  フォ: "fo",
  フュ: "hyu",
  ヴァ: "va",
  ヴィ: "vi",
  ヴェ: "ve",
  ヴォ: "vo",
  ウィ: "wi",
  ウェ: "we",
  ウォ: "wo",
  ティ: "ti",
  トゥ: "tu",
  テュ: "tyu",
  ディ: "di",
  ドゥ: "du",
  デュ: "dyu",
  ツァ: "tsa",
  ツィ: "tsi",
  ツェ: "tse",
  ツォ: "tso",
  クァ: "kwa",
  クィ: "kwi",
  クェ: "kwe",
  クォ: "kwo",
  グァ: "gwa",
  グィ: "gwi",
  グェ: "gwe",
  グォ: "gwo",
  イェ: "ye",
  スィ: "si",
  ズィ: "zi",
};

const SOKUON = "ッ";
const LONG_VOWEL = "ー";
const CLOSURE_KEY = "cl";

// -- Functions ----------------------------------------------------------------

function toKatakana(text: string): string {
  return text.replace(/[ぁ-ゖゝゞ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

function isKana(char: string): boolean {
  return /[぀-ヿㇰ-ㇿｦ-ﾟ]/.test(char);
}

/**
 * Kana → mora keys. "ー" repeats the previous vowel, "ッ" is a closure.
 * Returns null when a character isn't kana, so the caller can report it.
 */
function kanaToMorae(kana: string): string[] | null {
  const text = toKatakana(kana.normalize("NFKC"));
  const morae: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const pair = text.slice(i, i + 2);
    if (COMBINED_MORAE[pair]) {
      morae.push(COMBINED_MORAE[pair]);
      i++;
    } else if (char === SOKUON) {
      morae.push(CLOSURE_KEY);
    } else if (char === LONG_VOWEL) {
      const previous = morae[morae.length - 1];
      const vowel = previous && previous !== CLOSURE_KEY ? previous.slice(-1) : null;
      if (vowel && vowel !== "n") morae.push(vowel);
    } else if (BASE_MORAE[char]) {
      morae.push(BASE_MORAE[char]);
    } else {
      return null;
    }
  }
  return morae;
}

// -- Exports ------------------------------------------------------------------

export { isKana, kanaToMorae };
export type { ReadingToken };
