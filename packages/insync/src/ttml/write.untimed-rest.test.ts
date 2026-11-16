import { describe, expect, it } from "vitest";
import type { Syllable } from "../line";
import { lineFromFields } from "../line-from-fields";
import { backgroundText, lineText } from "../line-text";
import { backgroundTrack, isTimedSyllable, mainTrack, timedSyllables } from "../line-track";
import { withMainTrack, withTrackSyllables } from "../line-track-writes";
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

const exported = (line = partlySynced) =>
  generateTTML({
    metadata: { title: "Test", artists: [], album: "", duration: 60 },
    agents: [{ id: "v1", type: "person", name: "Lead" }],
    lines: [line],
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

  it("regression: an untimed rest syllable with kept attributes reads back as lyric text", () => {
    const main = mainTrack(partlySynced);
    const syllables = main.syllables.map((syllable) =>
      syllable.text === "fly" ? { ...syllable, passthrough: { attrs: [["class", "soft"] as const] } } : syllable,
    );
    const kept = withMainTrack(partlySynced, withTrackSyllables(main, syllables));
    const ttml = exported(kept);
    expect(ttml).toContain('birds</span> <span class="soft">fly</span> home');

    const [read] = parseTtml(ttml, SPLIT).lines;
    expect(lineText(read, SPLIT)).toBe("Silver birds fly home");
    expect(exported(read)).toBe(ttml);
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

  it("regression: a kept element between two kept spans of the untimed rest stays between them", () => {
    const paragraph =
      '<p begin="5.200" end="8.000" ttm:agent="v1"><span begin="5.200" end="6.100">Silver</span> <span x-cue="b">birds fly</span><marker/> <span x-cue="c">home</span></p>';
    const [read] = parseTtml(
      `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><body><div>${paragraph}</div></body></tt>`,
      SPLIT,
    ).lines;
    expect(lineText(read, SPLIT)).toBe("Silver birds fly home");
    expect(exported(read)).toMatch(/<span x-cue="b">birds fly<\/span>\s*<marker\/>\s*<span x-cue="c">home<\/span>/);
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

  it("regression: a kept element between kept spans of a background's untimed rest stays between them on a reread", () => {
    const source = exported().replace(
      "wa</span>ter keeps on</span>",
      'wa</span>ter <span x-cue="b">keeps</span> <marker/><span x-cue="c">on</span></span>',
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

describe("ttml · untimed rest after a punctuation syllable", () => {
  it("regression: a punctuation syllable before the untimed rest reads back once", () => {
    const line = lineFromFields(
      {
        id: "p",
        text: "ba|, tor",
        agentId: "v1",
        words: [
          { id: "p1", text: "ba", sep: "", begin: 1, end: 2, joinsNext: true },
          { id: "p2", text: ",", sep: " ", begin: 2, end: 3, joinsNext: false },
        ],
      },
      SPLIT,
    );
    const ttml = exported(line);
    const [reread] = parseTtml(ttml, SPLIT).lines;
    expect([lineText(line, SPLIT), lineText(reread, SPLIT)]).toEqual(["ba|, tor", "ba|, tor"]);
  });

  it("regression: a punctuation syllable split off after the last timed syllable is kept on a reread", () => {
    const timed = lineFromFields(
      {
        id: "q",
        text: "p(mi|vin",
        agentId: "v1",
        words: [
          { id: "q1", text: "p(mi", sep: "", begin: 1, end: 2, joinsNext: true },
          { id: "q2", text: "vin", sep: "", begin: 2, end: 2.5, joinsNext: true },
        ],
      },
      SPLIT,
    );
    const line = withMainTrack(
      timed,
      withTrackSyllables(mainTrack(timed), [
        ...mainTrack(timed).syllables,
        { id: "q3", text: ")", sep: "", joinsNext: false },
      ]),
    );
    const [reread] = parseTtml(exported(line), SPLIT).lines;
    expect([lineText(line, SPLIT), lineText(reread, SPLIT)]).toEqual(["p(mi|vin|)", "p(mi|vin|)"]);
  });
});
