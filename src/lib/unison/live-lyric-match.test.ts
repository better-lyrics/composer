import { describe, expect, it } from "vitest";
import type { LyricLine } from "@/domain/line/model";
import type { UnisonLyric } from "@/lib/unison/api-types";
import { matchesLiveLyric } from "@/lib/unison/live-lyric-match";
import { unisonLyricProject } from "@/lib/unison/save-unison-projects";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { generateTTML } from "@/utils/ttml";

// -- Helpers ------------------------------------------------------------------

function harborLines(secondWordBegin = 3): LyricLine[] {
  return [
    createLine({
      id: "harbor-1",
      text: "paper lanterns glow",
      words: [
        { text: "paper ", begin: 2, end: 3 },
        { text: "lanterns ", begin: secondWordBegin, end: 4 },
        { text: "glow", begin: 4, end: 6 },
      ],
    }),
  ];
}

function liveLyric(lines: LyricLine[], artists = ["Marisol Vega"]): UnisonLyric {
  const { agents } = useProjectStore.getState();
  const metadata = { ...useProjectStore.getState().metadata, artists };
  return {
    id: 5120,
    videoId: "harborVideo1",
    song: "Paper Lanterns",
    artist: artists.join(", "),
    album: "Harbor Songs",
    language: "en",
    lyrics: generateTTML({ metadata, agents, lines, groups: [] }),
    format: "ttml",
    syncType: "syllable",
    score: 2,
    effectiveScore: 2,
    voteCount: 2,
    confidence: "high",
    hidden: false,
    userVote: null,
    revision: { revNo: 2, count: 2, pending: null, lastRejected: null, updatedAt: 1_758_900_000_000 },
  };
}

function savedFrom(lyric: UnisonLyric) {
  const project = unisonLyricProject(lyric, null);
  if (!project) throw new Error("the fixture lyric must be readable");
  return project;
}

// -- Tests --------------------------------------------------------------------

describe("matchesLiveLyric", () => {
  it("treats a project as identical when the live lyric only moved word timing by a few milliseconds", () => {
    const project = savedFrom(liveLyric(harborLines()));

    expect(matchesLiveLyric(project, liveLyric(harborLines(3.003)))).toBe(true);
  });

  it("regression: a project with several artists matches the lyric that credits them together", () => {
    const artists = ["Marisol Vega", "Ines Duarte"];
    const live = liveLyric(harborLines(), artists);
    const project = savedFrom(live);

    expect(matchesLiveLyric({ ...project, metadata: { ...project.metadata, artists } }, live)).toBe(true);
  });

  describe("error paths", () => {
    it("never treats a project with a song detail the live lyric lacks as identical", () => {
      const project = savedFrom(liveLyric(harborLines()));
      const withSongwriter = { ...project, metadata: { ...project.metadata, songwriters: ["Ines Duarte"] } };

      expect(matchesLiveLyric(withSongwriter, liveLyric(harborLines()))).toBe(false);
    });
  });
});
