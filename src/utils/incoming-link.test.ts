import {
  IMPORT_HASH_PREFIX,
  LINKED_FILE_PARAM_NAMES,
  SONG_QUERY_PARAM_NAMES,
  hasIncomingLink,
  linkedFileName,
  readLinkedFileUrl,
  readTrimmed,
} from "@/utils/incoming-link";
import { describe, expect, it } from "vitest";

describe("readTrimmed", () => {
  it("reads and trims a present param", () => {
    expect(readTrimmed(new URLSearchParams("?title=%20Midnight%20City%20"), "title")).toBe("Midnight City");
  });

  describe("edge cases", () => {
    it("treats a missing param and a whitespace-only param both as null", () => {
      expect(readTrimmed(new URLSearchParams(""), "title")).toBeNull();
      expect(readTrimmed(new URLSearchParams("?title=%20%20"), "title")).toBeNull();
    });
  });
});

describe("hasIncomingLink", () => {
  it("recognizes every Better Lyrics video param", () => {
    for (const name of ["v", "videoId", "youtube"]) {
      expect(hasIncomingLink({ search: `?${name}=dX3k_QDnzHE`, hash: "" })).toBe(true);
    }
  });

  it("recognizes song metadata params and a converter hash", () => {
    for (const name of SONG_QUERY_PARAM_NAMES) {
      expect(hasIncomingLink({ search: `?${name}=x`, hash: "" })).toBe(true);
    }
    expect(hasIncomingLink({ search: "", hash: `${IMPORT_HASH_PREFIX}%7B%7D` })).toBe(true);
  });

  describe("edge cases", () => {
    it("ignores empty values, unrelated params and other hashes", () => {
      expect(hasIncomingLink({ search: "", hash: "" })).toBe(false);
      expect(hasIncomingLink({ search: "?title=%20%20&v=", hash: "" })).toBe(false);
      expect(hasIncomingLink({ search: "?utm_source=x", hash: "#top" })).toBe(false);
    });
  });
});

describe("hasIncomingLink: linked files", () => {
  it("recognizes audioUrl and lyricsUrl links", () => {
    for (const name of LINKED_FILE_PARAM_NAMES) {
      expect(hasIncomingLink({ search: `?${name}=https%3A%2F%2Fcdn.example.com%2Fsong.mp3`, hash: "" })).toBe(true);
    }
  });
});

describe("readLinkedFileUrl", () => {
  it("reads an absolute http or https URL", () => {
    const params = new URLSearchParams(
      "?audioUrl=https%3A%2F%2Fcdn.example.com%2Fa%2520b.mp3&lyricsUrl=http://x.test/l.lrc",
    );
    expect(readLinkedFileUrl(params, "audioUrl")).toBe("https://cdn.example.com/a%20b.mp3");
    expect(readLinkedFileUrl(params, "lyricsUrl")).toBe("http://x.test/l.lrc");
  });

  describe("edge cases", () => {
    it("rejects every non-web scheme, relative paths and missing params", () => {
      const rejected = [
        "javascript:alert(1)",
        "data:audio/mp3;base64,AA",
        "blob:https://x.test/1",
        "/song.mp3",
        "song.mp3",
        "ftp://x.test/a.mp3",
      ];
      for (const raw of rejected) {
        expect(readLinkedFileUrl(new URLSearchParams({ audioUrl: raw }), "audioUrl")).toBeNull();
      }
      expect(readLinkedFileUrl(new URLSearchParams(""), "audioUrl")).toBeNull();
      expect(readLinkedFileUrl(new URLSearchParams("?audioUrl=%20"), "audioUrl")).toBeNull();
    });
  });
});

describe("linkedFileName", () => {
  it("uses the decoded last path segment", () => {
    expect(linkedFileName("https://cdn.example.com/music/M83%20-%20Midnight%20City.mp3?sig=1", "Linked audio")).toBe(
      "M83 - Midnight City.mp3",
    );
  });

  describe("edge cases", () => {
    it("falls back when the path has no segment or a segment does not decode", () => {
      expect(linkedFileName("https://cdn.example.com/", "Linked audio")).toBe("Linked audio");
      expect(linkedFileName("https://cdn.example.com/%E0%A4%A.mp3", "Linked audio")).toBe("Linked audio");
    });
  });
});
