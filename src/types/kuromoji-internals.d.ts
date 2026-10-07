// The kuromoji fork ships types for its builder only. Auto-align builds the
// tokenizer from these internals so the dictionary loads through the app's
// download cache instead of the library's own fetch.

declare module "@sglkc/kuromoji/src/loader/DictionaryLoader.js" {
  class DictionaryLoader {
    constructor(dicPath: string);
    loadArrayBuffer: (url: string, callback: (err: unknown, buffer: ArrayBuffer | null) => void) => void;
    load(callback: (err: unknown, dictionaries: unknown) => void): void;
  }
  export default DictionaryLoader;
}

declare module "@sglkc/kuromoji/src/Tokenizer.js" {
  interface KuromojiToken {
    surface_form: string;
    /** 1-based character offset in the tokenized text. */
    word_position: number;
    pronunciation?: string;
    reading?: string;
  }
  class Tokenizer {
    constructor(dictionaries: unknown);
    tokenize(text: string): KuromojiToken[];
  }
  export default Tokenizer;
}
