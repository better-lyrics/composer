import type { ReadingToken } from "@/audio/alignment/hubertfa/japanese";

// -- Types --------------------------------------------------------------------

type LoadFile = (name: string) => Promise<ArrayBuffer>;

type ReadJapanese = (text: string) => ReadingToken[];

// -- Functions ----------------------------------------------------------------

async function gunzip(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

/**
 * Builds kuromoji's IPADIC tokenizer, reading each gzipped dictionary file
 * through `loadFile` (the app's download cache) rather than the library's
 * own fetch, whose URL joining also breaks absolute URLs.
 */
async function createJapaneseReader(loadFile: LoadFile): Promise<ReadJapanese> {
  const [{ default: DictionaryLoader }, { default: Tokenizer }] = await Promise.all([
    import("@sglkc/kuromoji/src/loader/DictionaryLoader.js"),
    import("@sglkc/kuromoji/src/Tokenizer.js"),
  ]);
  const loader = new DictionaryLoader("");
  loader.loadArrayBuffer = (url, callback) => {
    const name = url.split("/").pop() ?? url;
    loadFile(name)
      .then(gunzip)
      .then(
        (buffer) => callback(null, buffer),
        (err) => callback(err, null),
      );
  };
  const dictionaries = await new Promise<unknown>((resolve, reject) =>
    loader.load((err, dic) => (err ? reject(err) : resolve(dic))),
  );
  const tokenizer = new Tokenizer(dictionaries);
  return (text) =>
    tokenizer.tokenize(text).map((token) => ({
      surface: token.surface_form,
      start: token.word_position - 1,
      pronunciation: token.pronunciation && token.pronunciation !== "*" ? token.pronunciation : null,
    }));
}

// -- Exports ------------------------------------------------------------------

export { createJapaneseReader };
