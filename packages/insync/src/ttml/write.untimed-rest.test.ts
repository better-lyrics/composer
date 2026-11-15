import { describe, expect, it } from "vitest";
import { lineFromFields } from "../line-from-fields";
import { backgroundText, lineText } from "../line-text";
import { backgroundTrack, mainTrack, timedSyllables } from "../line-track";
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
});
