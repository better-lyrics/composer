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
import { splitIntoWordsWithMeta } from "@/utils/sync-helpers";

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

function wordAtoms(words: readonly WordTiming[]): string[] {
  return words.flatMap((word) => splitIntoWordsWithMeta(word.text).parts);
}

// Where each part of the text ends, found by walking the parts the shared tokenizer returned.
function partEnds(text: string, parts: string[]): number[] {
  const ends: number[] = [];
  let cursor = 0;
  for (const part of parts) {
    cursor = text.indexOf(part, cursor) + part.length;
    ends.push(cursor);
  }
  return ends;
}

// The words of a partly synced track spell the start of its text; the rest is lyrics not timed yet,
// returned with the separator that leads into it.
function untimedRest(text: string, words: readonly WordTiming[]): string {
  const written = splitIntoWordsWithMeta(text);
  const covered = wordAtoms(words);
  if (covered.length === 0 || covered.length >= written.parts.length) return "";
  if (covered.some((atom, i) => atom !== written.parts[i])) return "";
  return text.slice(partEnds(text, written.parts)[covered.length - 1]);
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

// Untimed syllables built here are new to the session. Ids count back from the end of the track, so separately built
// lines stay comparable and an untimed syllable keeps its id when more of the line before it is timed.
function untimedFromText(text: string, splitChar: string): Syllable[] {
  const syllables = textSyllables(text, splitChar);
  return syllables.map((syllable, index) => ({ ...syllable, id: `untimed-${syllables.length - 1 - index}` }));
}

function syllablesFromFields(text: string, words: readonly WordTiming[] | undefined, splitChar: string): Syllable[] {
  if (!words?.length) return untimedFromText(text, splitChar);
  const rest = untimedRest(text, words);
  if (rest === "") return [...words];
  return [...withClosingJoint(words, rest, splitChar), ...untimedFromText(rest, splitChar)];
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
