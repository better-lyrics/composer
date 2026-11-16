import { describe, expect, it } from "vitest";
import type { Syllable } from "../line";
import { lineFromFields } from "../line-from-fields";
import { backgroundText, lineText } from "../line-text";
import { backgroundTrack, isTimedSyllable, mainTrack, timedSyllables } from "../line-track";
import { withMainTrack } from "../line-track-writes";
import { DEFAULT_SPLIT_CHARACTER } from "../split-character-text";
import { wordsFromSpaced } from "../word-spaced-words";
import { parseTtml } from "./read";
import { generateTTML } from "./write";

const SPLIT = DEFAULT_SPLIT_CHARACTER;

const partlySynced = lineFromFields(
  {
    id: "a",
    text: "Silver birds fly home",
    agentId: "v1",
    words: wordsFromSpaced([
      { text: "Silver ", begin: 5.2, end: 6.1 },
      { text: "birds", begin: 6.1, end: 6.4 },
    ]),
    backgroundText: "wa|ter keeps on",
    backgroundWords: wordsFromSpaced([{ text: "wa", begin: 6.4, end: 6.8 }]),
  },
  SPLIT,
);

const exported = () =>
  generateTTML({
    metadata: { title: "Test", artists: [], album: "", duration: 60 },
    agents: [{ id: "v1", type: "person", name: "Lead" }],
    lines: [partlySynced],
    splitChar: SPLIT,
  });

describe("ttml · untimed rest of a partly synced line", () => {
  it("regression: export writes the untimed rest after the timed spans and a read keeps it untimed", () => {
    const ttml = exported();
    expect(ttml).toContain('<span begin="0:06.100" end="0:06.400">birds</span> fly home');
    expect(ttml).toContain('<span begin="0:06.400" end="0:06.800">wa</span>ter keeps on</span>');

    const [read] = parseTtml(ttml, SPLIT).lines;
    expect(lineText(read, SPLIT)).toBe(lineText(partlySynced, SPLIT));
    expect(backgroundText(read, SPLIT)).toBe(backgroundText(partlySynced, SPLIT));
    expect(timedSyllables(mainTrack(read)).map((word) => word.text)).toEqual(["Silver", "birds"]);
    expect(timedSyllables(backgroundTrack(read)).map((word) => word.text)).toEqual(["wa"]);
  });

  it("regression: an untimed rest written inside a kept span keeps its words and attributes on a reread", () => {
    const main = mainTrack(partlySynced);
    const syllables: Syllable[] = main.syllables.map((syllable) =>
      isTimedSyllable(syllable) ? syllable : { ...syllable, passthrough: { attrs: [["x-cue", "b"]] } },
    );
    const cued = withMainTrack(partlySynced, { id: main.id, role: "main", agentId: main.agentId, syllables });
    const ttml = generateTTML({
      metadata: { title: "Test", artists: [], album: "", duration: 60 },
      agents: [{ id: "v1", type: "person", name: "Lead" }],
      lines: [cued],
      splitChar: SPLIT,
    });
    expect(ttml).toContain('<span x-cue="b">fly home</span>');

    const [read] = parseTtml(ttml, SPLIT).lines;
    expect(lineText(read, SPLIT)).toBe("Silver birds fly home");
    const rest = mainTrack(read).syllables.filter((syllable) => !isTimedSyllable(syllable));
    expect(rest.map((syllable) => [syllable.text, syllable.passthrough?.attrs])).toEqual([
      ["fly", [["x-cue", "b"]]],
      ["home", [["x-cue", "b"]]],
    ]);
  });

  it("regression: a kept element between kept spans of an untimed rest stays between them on a reread", () => {
    const source = exported().replace(
      "birds</span> fly home",
      'birds</span> <span x-cue="b">fly</span> <marker/><span x-cue="c">home</span>',
    );
    const reread = generateTTML({
      metadata: { title: "Test", artists: [], album: "", duration: 60 },
      agents: [{ id: "v1", type: "person", name: "Lead" }],
      lines: parseTtml(source, SPLIT).lines,
      splitChar: SPLIT,
    });
    const first = reread.indexOf('x-cue="b"');
    const marker = reread.indexOf("<marker/>");
    expect(first).toBeGreaterThan(-1);
    expect(marker).toBeGreaterThan(first);
    expect(reread.indexOf('x-cue="c"')).toBeGreaterThan(marker);
  });
});
