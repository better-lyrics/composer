import { isSectionTagLine, readGeniusLyrics, readsAsGeniusLyrics } from "@/domain/lyrics-file/genius-text";
import { GENIUS_PAGE_COPY, TAGGED_LYRICS } from "@/test/genius-fixtures";
import { describe, expect, it } from "vitest";

const texts = (content: string) => readGeniusLyrics(content).lines.map((line) => line.text);

describe("readsAsGeniusLyrics", () => {
  it("reads a Genius page copy and tagged lyrics", () => {
    expect(readsAsGeniusLyrics(GENIUS_PAGE_COPY)).toBe(true);
    expect(readsAsGeniusLyrics(TAGGED_LYRICS)).toBe(true);
  });

  describe("regressions", () => {
    it("regression: one stray section tag stays plain text", () => {
      expect(readsAsGeniusLyrics("[Chorus]\nHello")).toBe(false);
    });

    it("regression: brackets that are not section tags stay plain text", () => {
      expect(readsAsGeniusLyrics("[laughs]\nHello\n[sighs]\nBye")).toBe(false);
    });
  });
});

describe("isSectionTagLine", () => {
  it("matches whole-line Genius section tags only", () => {
    expect(isSectionTagLine("[Pre-Chorus: Drake]")).toBe(true);
    expect(isSectionTagLine("  [verse 2]  ")).toBe(true);
    expect(isSectionTagLine("Hello [Chorus]")).toBe(false);
    expect(isSectionTagLine("[laughs]")).toBe(false);
  });
});

describe("readGeniusLyrics", () => {
  it("drops tags, the page header, inline promos and the Embed counter", () => {
    expect(texts(GENIUS_PAGE_COPY)).toEqual([
      "Yeah, yeah",
      "",
      "Midnight rain on the window glass",
      "Counting the hours as they pass",
      "Hold on, we're almost home tonight",
      "",
      "Streetlights flicker in the morning haze",
      "",
      "We'll remember these golden days",
    ]);
  });

  it("keeps lyrics before the first tag when there is no page header", () => {
    expect(texts("Opening line\n[Verse 1]\nNext\n[Chorus]\nLast")).toEqual(["Opening line", "Next", "Last"]);
  });

  describe("edge cases", () => {
    it("drops a last line that held only the Embed counter", () => {
      expect(texts("[Verse]\nA\n[Chorus]\nB\n12Embed")).toEqual(["A", "B"]);
    });

    it("strips Embed only from the last lyric", () => {
      expect(texts("[Verse]\nI embed\n[Chorus]\nB")).toEqual(["I embed", "B"]);
    });

    it("never leaves leading or trailing blank lines", () => {
      expect(texts("[Verse]\n\nA\n\n[Chorus]\n")).toEqual(["A"]);
    });

    it("regression: keeps opening lyrics between the page title and the first tag", () => {
      expect(texts("12 Contributors\nSong Lyrics\nOpening lyric\n[Chorus]\nNext lyric\n[Verse]\nLast")).toEqual([
        "Opening lyric",
        "Next lyric",
        "Last",
      ]);
    });

    it("regression: drops the song description under the page title", () => {
      expect(
        texts(
          '12 Contributors\nSong Lyrics\n"Song" is the lead single from the album... Read More\n[Intro]\nYeah\n[Verse]\nGo',
        ),
      ).toEqual(["Yeah", "Go"]);
    });

    it("regression: drops the page header when the copy has no section tags", () => {
      expect(texts("12 Contributors\nTranslations\nEspañol\nSong Lyrics\nFirst\nSecond")).toEqual(["First", "Second"]);
    });
  });
});

describe("credits", () => {
  const read = (content: string) => readGeniusLyrics(content);

  it("makes the lead first, then one singer per credited performer or combination", () => {
    expect(read(GENIUS_PAGE_COPY).agents).toEqual([
      { id: "v1", type: "person", name: "Lead" },
      { id: "v2", type: "person", name: "Drake" },
      { id: "v1000", type: "group", name: "Drake, Rihanna" },
      { id: "v3", type: "person", name: "Rihanna" },
    ]);
  });

  it("assigns each line to its section's singer, uncredited sections to the lead", () => {
    const agentOf = (text: string) => read(GENIUS_PAGE_COPY).lines.find((line) => line.text === text)?.agentId;
    expect(agentOf("Midnight rain on the window glass")).toBe("v2");
    expect(agentOf("Hold on, we're almost home tonight")).toBe("v1000");
    expect(agentOf("Streetlights flicker in the morning haze")).toBe("v3");
    expect(agentOf("We'll remember these golden days")).toBe("v1");
  });

  it("makes no lead when every section is credited", () => {
    expect(read("[Verse: Drake]\n1\n[Chorus: Drake & Rihanna]\n2").agents?.map((agent) => agent.name)).toEqual([
      "Drake",
      "Drake, Rihanna",
    ]);
  });

  it("splits an artist list on commas and the final ampersand", () => {
    expect(read("[Verse: A, B & C]\n1\n[Chorus: C & A & B]\n2").agents).toEqual([
      { id: "v1000", type: "group", name: "A, B, C" },
    ]);
  });

  it("gives different artist lists the one group singer, named Chorus", () => {
    const result = read("[Verse: A & B]\n1\n[Chorus: C & D]\n2");
    expect(result.agents).toEqual([{ id: "v1000", type: "group", name: "Chorus" }]);
    expect(result.lines.map((line) => line.agentId)).toEqual(["v1000", "v1000"]);
  });

  describe("regressions", () => {
    it("regression: lines before the first credit belong to the lead, not the featured singer", () => {
      const result = read("[Verse 1]\nA\n[Verse 2: Rihanna]\nB\n[Chorus]\nC");
      expect(result.agents).toEqual([
        { id: "v1", type: "person", name: "Lead" },
        { id: "v2", type: "person", name: "Rihanna" },
      ]);
      expect(result.lines.map((line) => line.agentId)).toEqual(["v1", "v2", "v1"]);
    });

    it("regression: an uncredited section after a featured intro belongs to the lead", () => {
      const result = read("[Intro: Rihanna]\nA\n[Verse 1]\nB");
      expect(result.agents?.map((agent) => agent.name)).toEqual(["Lead", "Rihanna"]);
      expect(result.lines.map((line) => line.agentId)).toEqual(["v2", "v1"]);
    });

    it("regression: one artist list in any order is one singer", () => {
      const result = read("[Chorus: Kanye West, Kid Cudi & Jay-Z]\n1\n[Outro: Kid Cudi, Kanye West & Jay-Z]\n2");
      expect(result.agents).toHaveLength(1);
    });

    it("regression: an artist name with a comma or a joining word stays one singer", () => {
      const names = read("[Verse: Tyler, The Creator]\n1\n[Chorus: Florence and the Machine]\n2").agents?.map(
        (agent) => agent.name,
      );
      expect(names).toEqual(["Tyler, The Creator", "Florence and the Machine"]);
    });
  });

  describe("edge cases", () => {
    it("declares no singers when no tag has a credit", () => {
      expect(read(TAGGED_LYRICS).agents).toBeUndefined();
    });

    it("matches performers case-insensitively and keeps the first spelling", () => {
      expect(read("[Verse: Drake]\n1\n[Chorus: drake]\n2").agents).toEqual([
        { id: "v1", type: "person", name: "Drake" },
      ]);
    });

    it("strips Genius emphasis marks around names", () => {
      expect(read("[Verse: *Drake*]\n1\n[Chorus: (Rihanna)]\n2").agents?.map((agent) => agent.name)).toEqual([
        "Drake",
        "Rihanna",
      ]);
    });

    it("regression: keeps marks that are part of a name", () => {
      const names = read("[Verse: Jay-Z (feat. Kanye)]\n1\n[Chorus: *NSYNC]\n2").agents?.map((agent) => agent.name);
      expect(names).toEqual(["Jay-Z (feat. Kanye)", "*NSYNC"]);
    });

    it("regression: unwraps each emphasised name in a credit list", () => {
      expect(read("[Verse: *Drake* & *Future*]\n1\n[Chorus: _Future_ & _Drake_]\n2").agents).toEqual([
        { id: "v1000", type: "group", name: "Drake, Future" },
      ]);
    });

    it("regression: unwraps a whole emphasised credit and nested marks", () => {
      expect(read("[Verse: *Drake & Future*]\n1\n[Chorus: (Future & Drake)]\n2").agents).toEqual([
        { id: "v1000", type: "group", name: "Drake, Future" },
      ]);
      expect(read("[Verse: **Drake**]\n1\n[Chorus: (a) (b)]\n2").agents?.map((agent) => agent.name)).toEqual([
        "Drake",
        "(a) (b)",
      ]);
    });

    it("regression: an uncredited section holding only the Embed counter makes no lead", () => {
      expect(read("[Verse: Drake]\n1\n[Outro]\n12Embed").agents).toEqual([{ id: "v1", type: "person", name: "Drake" }]);
    });
  });
});
