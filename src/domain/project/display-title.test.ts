import {
  displayArtists,
  displayTitle,
  hasArtists,
  quotedTitle,
  youtubeSourceTitle,
} from "@/domain/project/display-title";
import { describe, expect, it } from "vitest";

describe("displayTitle", () => {
  it("returns the title when it is set", () => {
    expect(displayTitle("Midnight City")).toBe("Midnight City");
  });

  describe("edge cases", () => {
    it("falls back to Untitled for an empty title", () => {
      expect(displayTitle("")).toBe("Untitled");
    });

    it("keeps a whitespace-only title as is", () => {
      expect(displayTitle(" ")).toBe(" ");
    });
  });
});

describe("quotedTitle", () => {
  it("wraps the title in curly quotes", () => {
    expect(quotedTitle("Midnight City")).toBe("“Midnight City”");
  });

  describe("edge cases", () => {
    it("quotes the Untitled fallback for an empty title", () => {
      expect(quotedTitle("")).toBe("“Untitled”");
    });
  });
});

describe("displayArtists", () => {
  it("joins several artists", () => {
    expect(displayArtists(["Lady Gaga", "Bruno Mars"])).toBe("Lady Gaga, Bruno Mars");
  });

  it("returns a single artist as is", () => {
    expect(displayArtists(["M83"])).toBe("M83");
  });

  describe("edge cases", () => {
    it("falls back to No artist for an empty list", () => {
      expect(displayArtists([])).toBe("No artist");
    });

    it("falls back to No artist when every artist is blank", () => {
      expect(displayArtists([""])).toBe("No artist");
      expect(displayArtists(["", " "])).toBe("No artist");
    });

    it("skips blank artists between named ones", () => {
      expect(displayArtists(["Lady Gaga", "", "Bruno Mars"])).toBe("Lady Gaga, Bruno Mars");
    });
  });
});

describe("hasArtists", () => {
  it("is true when an artist is named", () => {
    expect(hasArtists(["M83"])).toBe(true);
  });

  describe("edge cases", () => {
    it("is false for an empty list or only blank artists", () => {
      expect(hasArtists([])).toBe(false);
      expect(hasArtists([""])).toBe(false);
      expect(hasArtists([" ", ""])).toBe(false);
    });
  });

  describe("invariants", () => {
    it("is false exactly when displayArtists shows the fallback", () => {
      for (const artists of [[], [""], ["M83"], ["", "M83"], [" "]]) {
        expect(hasArtists(artists)).toBe(displayArtists(artists) !== "No artist");
      }
    });
  });
});

describe("youtubeSourceTitle", () => {
  it("uses the project title once it is known", () => {
    expect(youtubeSourceTitle("Never Gonna Give You Up", "dQw4w9WgXcQ")).toBe("Never Gonna Give You Up");
  });

  describe("edge cases", () => {
    it("falls back to the video id for an empty title or one that is still the video id", () => {
      expect(youtubeSourceTitle("", "dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
      expect(youtubeSourceTitle("dQw4w9WgXcQ", "dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });
  });
});
