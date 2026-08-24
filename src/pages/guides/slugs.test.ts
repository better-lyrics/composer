import { GUIDE_ENTRIES } from "@/pages/guides/guide-page";
import { GUIDES } from "@/pages/guides/guides-index";
import { GUIDE_SLUGS } from "@/pages/guides/slugs";
import { routes } from "@/router";
import { describe, expect, it } from "vitest";

const sorted = (values: readonly string[]) => [...values].sort();

describe("guide slug registry", () => {
  it("regression: every guide with a page entry is prerendered", () => {
    expect(sorted(Object.keys(GUIDE_ENTRIES))).toEqual(sorted(GUIDE_SLUGS));
  });

  it("regression: every guide listed on the index is prerendered", () => {
    expect(sorted(GUIDES.map((guide) => guide.slug))).toEqual(sorted(GUIDE_SLUGS));
  });

  it("emits one static path per slug from the router", () => {
    const guideRoute = routes.find((route) => route.path === "/guides/:slug");
    expect(guideRoute?.getStaticPaths?.()).toEqual(GUIDE_SLUGS.map((slug) => `/guides/${slug}`));
  });

  it("invariant: slugs are unique", () => {
    expect(new Set(GUIDE_SLUGS).size).toBe(GUIDE_SLUGS.length);
  });

  it("invariant: slugs are URL-safe and lowercase", () => {
    for (const slug of GUIDE_SLUGS) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("invariant: every related link points at a real guide", () => {
    for (const entry of Object.values(GUIDE_ENTRIES)) {
      for (const related of entry.related) {
        if (!related.path.startsWith("/guides/")) continue;
        expect(GUIDE_SLUGS).toContain(related.path.slice("/guides/".length));
      }
    }
  });
});
