import { linkSuggestions } from "@/domain/unison/link-suggestions";
import { indexEntry } from "@/test/index-entries";
import { describe, expect, it } from "vitest";

const youtube = (videoId: string, overrides = {}) => indexEntry(videoId, { videoId, lineCount: 12, ...overrides });

describe("linkSuggestions", () => {
  it("pairs a project only with the one unlinked lyric sent for its video, or for its song when it has no video", () => {
    const projects = [
      youtube("paper-lanterns"),
      { ...youtube("harbor-lights"), id: "harbor-a" },
      { ...youtube("harbor-lights"), id: "harbor-b" },
      youtube("already-linked", { unisonLyricId: "30" }),
      youtube("lyric-taken"),
      youtube("empty", { lineCount: 0 }),
      indexEntry("local-file", { lineCount: 12 }),
      indexEntry("tide-file", { title: "Tide Pools", artists: ["Marisol Vega"], lineCount: 9 }),
      { ...youtube("other-cut"), title: "Tide Pools", artists: ["Marisol Vega"] },
    ];
    const lyrics = [
      { id: 10, videoId: "paper-lanterns" },
      { id: 20, videoId: "harbor-lights" },
      { id: 31, videoId: "already-linked" },
      { id: 40, videoId: "lyric-taken" },
      { id: 50, videoId: "empty" },
      { id: 60, videoId: "tide-pools", song: "tide pools ", artist: "Marisol Vega" },
    ];
    const linkedElsewhere = youtube("other-video", { id: "keeper", unisonLyricId: "40" });

    expect(linkSuggestions([...projects, linkedElsewhere], lyrics)).toEqual([
      { projectId: "paper-lanterns", lyricId: "10" },
      { projectId: "tide-file", lyricId: "60" },
    ]);
  });
});
