import { IMPORT_HASH_PREFIX, SONG_QUERY_PARAM_NAMES, hasIncomingLink, readTrimmed } from "@/utils/incoming-link";
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
