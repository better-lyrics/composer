// Turns lyric lines into the units and phones auto-align would use, with the
// app's own modules, so training labels and the browser never disagree.
//
//   pnpm -s phonemize --languages en,zh,ja --dictionary dictionary.txt < lines.jsonl > units.jsonl
//
// Input: one JSON object per line, { "id", "language", "text" }; `language` is
// the song's language tag (es, ko, pt-BR...), as set in a project.
// Output: { "id", "language", "units": [{ "text", "reader", "sounds", "phones", "guessed" }] }
// per line, or { "id", "language", "unknown": [...] } when a word can't be read.
// `phones` are vocabulary keys ("en/k", "ja/N"); `sounds` are the reader's
// sounds, null for words read by the English, Mandarin or Japanese dictionaries.
//
// --languages   the model manifest's languages, which pick the donor phones (default: en).
//               Mandarin and Japanese words take English stand-in phones unless zh / ja is listed.
// --dictionary  the model's English dictionary; without it English words are guessed from spelling
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { type G2pContext, lineToPhoneUnits } from "@/audio/alignment/hubertfa/g2p";
import { createJapaneseReader } from "@/audio/alignment/hubertfa/japanese-tokenizer";
import { parseDictionary } from "@/audio/alignment/hubertfa/lexicon";
import { hasHan, splitCjkPart } from "@/domain/alignment/cjk";
import { lineReadingFor } from "@/domain/alignment/language";
import { pinyin } from "pinyin-pro";

interface InputLine {
  id: unknown;
  language?: string;
  text: string;
}

const HUBERTFA = new URL("../src/audio/alignment/hubertfa/", import.meta.url);
const KUROMOJI_DICT = new URL("../node_modules/@sglkc/kuromoji/dict/", import.meta.url);

const { values } = parseArgs({
  options: { languages: { type: "string", default: "en" }, dictionary: { type: "string" } },
});
const modelLanguages = (values.languages ?? "en").split(",").map((language) => language.trim());
if (!values.dictionary) console.error("phonemize: no --dictionary, so English words are guessed from spelling");

const english = parseDictionary(values.dictionary ? await readFile(values.dictionary, "utf8") : "");
const mandarin = parseDictionary(await readFile(new URL("dictionary-zh.txt", HUBERTFA), "utf8"));
const japanese = parseDictionary(await readFile(new URL("dictionary-ja.txt", HUBERTFA), "utf8"));
let readJapanese: G2pContext["readJapanese"] = null;
const pinyinOf: G2pContext["pinyinOf"] = (text) =>
  pinyin(text, { toneType: "none", type: "all", v: true }).map((s) => (s.isZh ? s.pinyin : null));

async function japaneseReader(): Promise<NonNullable<G2pContext["readJapanese"]>> {
  readJapanese ??= await createJapaneseReader(async (name) => {
    const file = await readFile(new URL(name, KUROMOJI_DICT));
    return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  });
  return readJapanese;
}

async function phonemize({ id, language, text }: InputLine) {
  // Each space-separated word, split into the parts the app times on their own.
  const words = text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => splitCjkPart(word));
  const parts = words.flat();
  const { hanReading, latinReader } = lineReadingFor(language, [{ text }]);
  const result = lineToPhoneUnits(words, {
    dictionaries: { en: english, zh: mandarin, ja: japanese },
    hanReading,
    pinyinOf: hanReading === "zh" && hasHan(text) ? pinyinOf : null,
    readJapanese: hanReading === "ja" ? await japaneseReader() : null,
    latinReader,
    modelLanguages,
  });
  if (result.kind === "unknown") return { id, language, unknown: result.words };
  const units = result.units.map((unit) => ({
    text: unit.parts.map((part) => parts[part]).join(""),
    reader: unit.reader ?? unit.phones[0]?.language ?? null,
    sounds: unit.sounds ?? null,
    phones: unit.phones.map(({ language: phoneLanguage, phone }) => `${phoneLanguage}/${phone}`),
    guessed: unit.guessed ?? false,
  }));
  return { id, language, units };
}

for await (const line of createInterface({ input: process.stdin, crlfDelay: Number.POSITIVE_INFINITY })) {
  if (!line.trim()) continue;
  try {
    process.stdout.write(`${JSON.stringify(await phonemize(JSON.parse(line) as InputLine))}\n`);
  } catch (error) {
    console.error(`phonemize: skipped a line that failed (${(error as Error).message}): ${line}`);
  }
}
