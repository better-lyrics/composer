import { describe, expect, it } from "vitest";
import type { SuggestedVideo } from "@/lib/unison/api-types";
import { fitsSongLength, playsUnlinkedVideo, submitVideoChoices, VIDEO_LINK_LIMIT } from "@/domain/unison/video-links";

// -- Fixtures ------------------------------------------------------------------

const MAIN_ID = "fJ9rUzIMcZQ";
const SONG_SECONDS = 355;

function suggestion(videoId: string, overrides: Partial<SuggestedVideo> = {}): SuggestedVideo {
  return {
    videoId,
    title: "Bohemian Rhapsody (Remastered 2011)",
    artist: "Queen",
    artists: ["Queen"],
    artistChannelIds: [],
    album: null,
    durationSeconds: SONG_SECONDS,
    videoType: "song",
    artworkUrl: null,
    matchScore: 0.9,
    match: { level: "same", score: 0.9 },
    ...overrides,
  };
}

const SAME = suggestion("Same0000001");
const RELATED = suggestion("Related0001", { match: { level: "related", score: 0.6 } });
const UNRATED = suggestion("Unrated0001", { match: null });

function choices(overrides: Partial<Parameters<typeof submitVideoChoices>[0]> = {}) {
  return submitVideoChoices({
    suggestions: [SAME, RELATED, UNRATED],
    mainVideoId: MAIN_ID,
    songSeconds: SONG_SECONDS,
    dismissed: new Set(),
    chosen: [],
    ...overrides,
  });
}

const ids = (videos: readonly { videoId: string }[]) => videos.map((video) => video.videoId);

// -- Tests ---------------------------------------------------------------------

describe("fitsSongLength", () => {
  it("accepts a length within 2 s either way", () => {
    expect(fitsSongLength(357, SONG_SECONDS)).toBe(true);
    expect(fitsSongLength(353, SONG_SECONDS)).toBe(true);
  });

  it("rejects a length more than 2 s away", () => {
    expect(fitsSongLength(357.5, SONG_SECONDS)).toBe(false);
    expect(fitsSongLength(352, SONG_SECONDS)).toBe(false);
  });
});

describe("submitVideoChoices", () => {
  it("links same-recording suggestions and lists the rest as more matches", () => {
    const result = choices();
    expect(result.linked).toEqual([{ videoId: SAME.videoId, suggestion: SAME, origin: "suggested" }]);
    expect(ids(result.more)).toEqual([RELATED.videoId, UNRATED.videoId]);
  });

  it("never links a same match whose length is off", () => {
    const longer = suggestion("Longer00001", { durationSeconds: SONG_SECONDS + 30 });
    const result = choices({ suggestions: [longer] });
    expect(result.linked).toEqual([]);
    expect(ids(result.more)).toEqual([longer.videoId]);
  });

  it("never offers the main video", () => {
    const result = choices({ suggestions: [suggestion(MAIN_ID), RELATED] });
    expect(ids(result.linked)).toEqual([]);
    expect(ids(result.more)).toEqual([RELATED.videoId]);
  });

  it("links a video once even when the server repeats it", () => {
    const result = choices({ suggestions: [SAME, SAME, RELATED, RELATED] });
    expect(ids(result.linked)).toEqual([SAME.videoId]);
    expect(ids(result.more)).toEqual([RELATED.videoId]);
  });

  it("stops suggesting links at the limit, counting the main video", () => {
    const many = Array.from({ length: VIDEO_LINK_LIMIT + 3 }, (_, i) =>
      suggestion(`Same${String(i).padStart(7, "0")}`),
    );
    const result = choices({ suggestions: many });
    expect(result.linked).toHaveLength(VIDEO_LINK_LIMIT - 1);
    expect(result.more).toHaveLength(4);
  });
});

describe("playsUnlinkedVideo", () => {
  const links = [
    { videoId: MAIN_ID, isPrimary: true },
    { videoId: "lYr1cV1d3o0", isPrimary: false },
  ];

  it("allows a project with no video, and links that have not loaded", () => {
    expect(playsUnlinkedVideo(undefined, MAIN_ID, links)).toBe(false);
    expect(playsUnlinkedVideo("oth3rV1d3o0", MAIN_ID, undefined)).toBe(false);
  });

  it("regression: flags a project whose audio was replaced with a video the lyric does not link", () => {
    expect(playsUnlinkedVideo("oth3rV1d3o0", MAIN_ID, links)).toBe(true);
  });
});
