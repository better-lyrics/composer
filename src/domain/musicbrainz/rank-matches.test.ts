import { rankMatches } from "@/domain/musicbrainz/rank-matches";
import { YOUR_POWER_ALBUM_RECORDING_ID } from "@/test/musicbrainz-recording-fixtures";
import { YOUR_POWER_SEARCH } from "@/test/musicbrainz-search-fixtures";
import { describe, expect, it } from "vitest";

const rankedIds = (durationSec: number | null) =>
  rankMatches(YOUR_POWER_SEARCH.recordings, durationSec).map((match) => match.recording.id);

describe("rankMatches", () => {
  it("puts the album recording first for album-length audio", () => {
    expect(rankedIds(246)[0]).toBe(YOUR_POWER_ALBUM_RECORDING_ID);
  });

  it("reports the length difference in seconds", () => {
    const [best] = rankMatches(YOUR_POWER_SEARCH.recordings, 246);
    expect(best.lengthDeltaSec).toBeCloseTo(-0.1, 1);
    expect(best.matchesAudio).toBe(true);
  });

  describe("edge cases", () => {
    it("ranks without audio by plain recordings, then score", () => {
      expect(rankedIds(null)[0]).toBe(YOUR_POWER_ALBUM_RECORDING_ID);
    });

    it("leaves the delta null when MusicBrainz has no length", () => {
      const [only] = rankMatches([{ id: "x", title: "t", length: null, score: 100 }], 200);
      expect(only.lengthDeltaSec).toBeNull();
      expect(only.matchesAudio).toBe(false);
    });

    it("returns an empty list for no recordings", () => {
      expect(rankMatches([], 200)).toEqual([]);
    });
  });

  describe("invariants", () => {
    it("does not mutate its input", () => {
      const before = YOUR_POWER_SEARCH.recordings.map((recording) => recording.id);
      rankMatches(YOUR_POWER_SEARCH.recordings, 232);
      expect(YOUR_POWER_SEARCH.recordings.map((recording) => recording.id)).toEqual(before);
    });

    it("prefers a live take when it is the only one matching the audio", () => {
      const [best] = rankMatches(YOUR_POWER_SEARCH.recordings, 232);
      expect(best.recording.disambiguation).toContain("Prime Day");
    });
  });
});
