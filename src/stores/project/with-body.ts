import { docFromFlatLines } from "insync/group-doc-from-flat-lines";
import { flattenBody, knownFlatLines } from "insync/group-flatten";
import type { LyricDoc } from "insync/group";
import type { LyricLine } from "insync/line";
import { getSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

interface DocLines {
  doc: LyricDoc;
  lines: LyricLine[];
}

// -- Constants ----------------------------------------------------------------

const docByLines = new WeakMap<readonly LyricLine[], LyricDoc>();

// -- Functions ----------------------------------------------------------------

// The one way the store sets `lines`: the flattened view of the doc it is written with.
function withBody(doc: LyricDoc): DocLines {
  const lines = flattenBody(doc);
  docByLines.set(lines, doc);
  return { doc, lines };
}

// Lines the store wrote with a doc find it again; any other lines are read like a load.
function docOfLines(lines: LyricLine[]): LyricDoc {
  const known = docByLines.get(lines);
  if (known) return known;
  const doc = docFromFlatLines(lines, getSplitCharacter());
  docByLines.set(lines, doc);
  return doc;
}

// The doc of the lines on screen. Lines written without their doc (a gesture preview, a test seeding the store) are
// read back from the flat lines, as a load is.
function projectDoc(state: DocLines): LyricDoc {
  return knownFlatLines(state.doc) === state.lines ? state.doc : docOfLines(state.lines);
}

function emptyBody(): DocLines {
  return withBody(docFromFlatLines([], getSplitCharacter()));
}

// -- Exports ------------------------------------------------------------------

export type { DocLines };
export { docOfLines, emptyBody, projectDoc, withBody };
