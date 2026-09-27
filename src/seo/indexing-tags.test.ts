import { describe, expect, it } from "vitest";
import { indexingTags } from "@/seo/indexing-tags";
import { SITE_ORIGIN } from "@/seo/schemas";

describe("indexingTags", () => {
  it("points an indexable page at its canonical URL", () => {
    expect(indexingTags("/about", false)).toEqual({ canonical: `${SITE_ORIGIN}/about` });
  });

  it("asks crawlers to skip a noindex page and gives it no canonical URL", () => {
    expect(indexingTags("/no-such-page", true)).toEqual({ robots: "noindex" });
  });

  describe("edge cases", () => {
    it("keeps the root path canonical", () => {
      expect(indexingTags("/", false)).toEqual({ canonical: `${SITE_ORIGIN}/` });
    });
  });
});
