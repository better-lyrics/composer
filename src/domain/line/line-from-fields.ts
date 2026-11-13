import type { LineLanguages } from "@/domain/language/model";
import type {
  BackgroundSource,
  BackgroundTrack,
  LyricLine,
  MainTrack,
  Syllable,
  TrackTiming,
} from "@/domain/line/model";
import { textSyllables } from "@/domain/line/syllables-from-text";
import { trackText } from "@/domain/line/text";
import { backgroundTrack, isSpanTimed, mainTrack, timedSyllables } from "@/domain/line/track";
import type { WordTiming } from "@/domain/word/timing";
import { getSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

// A line spelled the way version 3 records, links and parsers spell it: stored text, words and background fields.
interface LineFields {
  id: string;
  text: string;
  agentId: string;
  words?: WordTiming[];
  begin?: number;
  end?: number;
  backgroundText?: string;
  backgroundWords?: WordTiming[];
  backgroundTextSource?: BackgroundSource;
  languages?: LineLanguages;
  groupId?: string;
  instanceIdx?: number;
  templateLineIdx?: number;
  detached?: boolean;
}

// -- Untimed rest -------------------------------------------------------------

const LETTER = /[\p{L}\p{N}\p{M}]/u;
const TEXT_WORD = /\S+/g;

const isLetter = (char: string | undefined) => char !== undefined && LETTER.test(char);

// The text after the timed words, matched letter by letter so split marks of any character and unmarked splits
// still line up. A load never drops text: when the words do not spell the start of the text, all of it stays.
function untimedRest(text: string, words: readonly WordTiming[], splitChar: string): string {
  const letters = words
    .map((word) => word.text)
    .join("")
    .replace(/\s+/g, "");
  let at = 0;
  for (const { 0: token, index } of text.matchAll(TEXT_WORD)) {
    let offset = 0;
    for (; offset < token.length && at < letters.length; offset++) {
      const char = token[offset];
      while (at < letters.length && letters[at] !== char && !isLetter(letters[at])) at++;
      if (letters[at] === char) at++;
      else if (isLetter(char)) return text;
    }
    if (at < letters.length) continue;
    const remainder = token.slice(offset);
    const rest = text.slice(index + token.length);
    if (remainder === "") return rest.trim() === "" ? "" : rest;
    return isLetter(remainder[0]) ? splitChar + remainder + rest : remainder + rest;
  }
  return "";
}

// A save cannot spell what joins the last timed word to the untimed rest, so the text decides it once on load.
function withClosingJoint(words: readonly WordTiming[], rest: string, splitChar: string): WordTiming[] {
  const last = words.length - 1;
  const space = /^\s*/.exec(rest)?.[0] ?? "";
  const joinsNext = space === "" && rest.startsWith(splitChar);
  const sep = words[last].sep === "" ? space : words[last].sep;
  const closing = words[last];
  if (closing.sep === sep && closing.joinsNext === joinsNext) return [...words];
  return words.with(last, { ...closing, sep, joinsNext });
}

function syllablesFromFields(text: string, words: readonly WordTiming[] | undefined, splitChar: string): Syllable[] {
  if (!words?.length) return textSyllables(text, splitChar);
  const rest = untimedRest(text, words, splitChar);
  if (rest === "") return [...words];
  return [...withClosingJoint(words, rest, splitChar), ...textSyllables(rest, splitChar)];
}

// -- Tracks -------------------------------------------------------------------

function trackTiming(
  id: string,
  text: string,
  words: WordTiming[] | undefined,
  span: { begin?: number; end?: number },
  splitChar: string,
): TrackTiming {
  const syllables = syllablesFromFields(text, words, splitChar);
  if (words?.length || span.begin === undefined || span.end === undefined) return { id, syllables };
  return {
    id,
    syllables: syllables.map(({ begin: _b, end: _e, ...untimed }) => untimed),
    begin: span.begin,
    end: span.end,
  };
}

function mainTrackFromFields(fields: LineFields, splitChar: string): MainTrack {
  const timing = trackTiming(`${fields.id}:main`, fields.text, fields.words, fields, splitChar);
  return { ...timing, role: "main", agentId: fields.agentId };
}

function backgroundTrackFromFields(fields: LineFields, splitChar: string): BackgroundTrack | undefined {
  const { backgroundText, backgroundWords, backgroundTextSource } = fields;
  if (backgroundText === undefined && backgroundWords === undefined && backgroundTextSource === undefined) {
    return undefined;
  }
  const timing = trackTiming(`${fields.id}:bg`, backgroundText ?? "", backgroundWords, {}, splitChar);
  return { ...timing, role: "bg", ...(backgroundTextSource && { source: backgroundTextSource }) };
}

// -- Functions ----------------------------------------------------------------

// A line from flat fields: timed words first, then the untimed rest of the text. Words win over a line span.
function lineFromFields(fields: LineFields, splitChar = getSplitCharacter()): LyricLine {
  const main = mainTrackFromFields(fields, splitChar);
  const background = backgroundTrackFromFields(fields, splitChar);
  return {
    id: fields.id,
    tracks: background ? [main, background] : [main],
    ...(fields.languages && { languages: fields.languages }),
    ...(fields.groupId !== undefined && { groupId: fields.groupId }),
    ...(fields.instanceIdx !== undefined && { instanceIdx: fields.instanceIdx }),
    ...(fields.templateLineIdx !== undefined && { templateLineIdx: fields.templateLineIdx }),
    ...(fields.detached !== undefined && { detached: fields.detached }),
  };
}

// The line spelled as flat fields again: the text read from the syllables, the timed ones as words.
function fieldsOfLine(line: LyricLine): LineFields {
  const main = mainTrack(line);
  const background = backgroundTrack(line);
  const words = timedSyllables(main);
  const backgroundWords = timedSyllables(background);
  return {
    id: line.id,
    text: trackText(main),
    agentId: main.agentId,
    ...(words.length > 0 && { words }),
    ...(isSpanTimed(main) && { begin: main.begin, end: main.end }),
    ...(background && {
      backgroundText: trackText(background),
      ...(backgroundWords.length > 0 && { backgroundWords }),
      ...(background.source && { backgroundTextSource: background.source }),
    }),
    ...(line.languages && { languages: line.languages }),
    ...(line.groupId !== undefined && { groupId: line.groupId }),
    ...(line.instanceIdx !== undefined && { instanceIdx: line.instanceIdx }),
    ...(line.templateLineIdx !== undefined && { templateLineIdx: line.templateLineIdx }),
    ...(line.detached !== undefined && { detached: line.detached }),
  };
}

// -- Exports ------------------------------------------------------------------

export { fieldsOfLine, lineFromFields, syllablesFromFields };
export type { LineFields };
