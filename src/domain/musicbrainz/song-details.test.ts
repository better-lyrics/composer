import { describe, expect, it } from "vitest";
import { pickAlbumRelease, pickDisplayRelease, songDetailsFrom } from "@/domain/musicbrainz/song-details";
import type { MbRecording, MbRelease } from "@/domain/musicbrainz/types";
import { YOUR_POWER_ALBUM_RECORDING } from "@/test/musicbrainz-recording-fixtures";

function release(
  id: string,
  status: string,
  date: string,
  primaryType: string,
  secondaryTypes: string[] = [],
): MbRelease {
  return {
    id,
    title: id,
    status,
    date,
    "release-group": { id: `group-${id}`, "primary-type": primaryType, "secondary-types": secondaryTypes },
  };
}

describe("songDetailsFrom", () => {
  const details = songDetailsFrom(YOUR_POWER_ALBUM_RECORDING);

  it("reads the album, ISRC, artists and songwriters", () => {
    expect(details.album).toBe("Happier Than Ever");
    expect(details.isrc).toBe("USUM72105934");
    expect(details.isrcs).toEqual(["USUM72105934"]);
    expect(details.artists).toEqual(["Billie Eilish"]);
    expect(details.songwriters).toEqual(["Billie Eilish", "FINNEAS"]);
  });

  it("points cover art at the album's release group", () => {
    expect(details.coverReleaseGroupId).toBe("3ac5236a-3bd8-44c6-ab60-69b013594ae6");
    expect(details.releaseYear).toBe("2021");
  });

  describe("regressions", () => {
    it("regression: skips earlier compilations when picking the album", () => {
      expect(pickAlbumRelease(YOUR_POWER_ALBUM_RECORDING.releases ?? [])?.title).toBe("Happier Than Ever");
    });
  });

  describe("edge cases", () => {
    it("returns empty details for a bare recording", () => {
      expect(songDetailsFrom({ id: "r", title: "Song" })).toMatchObject({
        album: null,
        isrc: null,
        artists: [],
        songwriters: [],
        coverReleaseGroupId: null,
        releaseYear: null,
        lengthSec: null,
      });
    });

    it("falls back to the earliest official studio release when there is no album", () => {
      const picked = pickAlbumRelease([
        release("live", "Official", "2019", "Album", ["Live"]),
        release("single", "Official", "2020", "Single"),
      ]);
      expect(picked?.title).toBe("single");
    });

    it("names a live take's release for display but never as its album", () => {
      const details = songDetailsFrom({
        id: "r",
        title: "Your Power",
        releases: [release("Prime Day Show", "Official", "2021", "Album", ["Live"])],
      });
      expect(details).toMatchObject({ album: null, releaseTitle: "Prime Day Show", releaseYear: "2021" });
      expect(details.coverReleaseGroupId).toBe("group-Prime Day Show");
    });

    it("still names a live take's release for display", () => {
      const live = release("Prime Day Show", "Official", "2021", "Album", ["Live"]);
      expect(pickAlbumRelease([live])).toBeNull();
      expect(pickDisplayRelease([live])?.title).toBe("Prime Day Show");
    });

    it("ignores releases that are not official", () => {
      expect(pickAlbumRelease([release("promo", "Promotion", "2019", "Album")])).toBeNull();
    });

    it("puts undated releases last", () => {
      const picked = pickAlbumRelease([
        release("undated", "Official", "", "Album"),
        release("dated", "Official", "2001", "Album"),
      ]);
      expect(picked?.title).toBe("dated");
    });

    it("keeps writer, composer and lyricist, drops arrangers and work links, dedupes by artist", () => {
      const recording: MbRecording = {
        id: "r",
        title: "t",
        relations: [
          {
            type: "performance",
            "target-type": "work",
            work: {
              id: "w",
              title: "t",
              relations: [
                { type: "writer", "target-type": "artist", artist: { id: "a", name: "A" } },
                { type: "lyricist", "target-type": "artist", artist: { id: "a", name: "A" } },
                { type: "arranger", "target-type": "artist", artist: { id: "b", name: "B" } },
                { type: "other version", "target-type": "work" },
              ],
            },
          },
        ],
      };
      expect(songDetailsFrom(recording).songwriters).toEqual(["A"]);
    });

    it("merges writers across several linked works", () => {
      const work = (id: string, artistId: string) => ({
        type: "performance",
        "target-type": "work",
        work: {
          id,
          title: id,
          relations: [{ type: "composer", "target-type": "artist", artist: { id: artistId, name: artistId } }],
        },
      });
      expect(
        songDetailsFrom({ id: "r", title: "t", relations: [work("w1", "A"), work("w2", "B")] }).songwriters,
      ).toEqual(["A", "B"]);
    });

    it("regression: uses the name the work credits, falling back to the artist name", () => {
      const artist = { id: "barikader", name: "Barikader" };
      const recording: MbRecording = {
        id: "r",
        title: "Ну я хоть попытался (а ты?)",
        relations: [
          {
            type: "performance",
            "target-type": "work",
            work: {
              id: "w",
              title: "Ну я хоть попытался (а ты?)",
              relations: [
                { type: "composer", "target-type": "artist", "target-credit": "Bondarenko Kyrylo", artist },
                { type: "lyricist", "target-type": "artist", "target-credit": "Bondarenko Kyrylo", artist },
                { type: "writer", "target-type": "artist", "target-credit": "", artist: { id: "b", name: "B" } },
              ],
            },
          },
        ],
      };
      expect(songDetailsFrom(recording).songwriters).toEqual(["Bondarenko Kyrylo", "B"]);
    });

    it("lists each credited artist separately", () => {
      const recording: MbRecording = {
        id: "r",
        title: "t",
        "artist-credit": [
          { name: "A", joinphrase: " & ", artist: { id: "1", name: "A" } },
          { name: "B", artist: { id: "2", name: "B" } },
        ],
      };
      expect(songDetailsFrom(recording).artists).toEqual(["A", "B"]);
    });
  });
});
