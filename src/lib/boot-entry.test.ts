import { bootEntryPath, redirectBootEntry } from "@/lib/boot-entry";
import { useSettingsStore } from "@/stores/settings";
import { afterEach, describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function at(url: string): { pathname: string; search: string; hash: string } {
  const parsed = new URL(url, "https://composer.test");
  return { pathname: parsed.pathname, search: parsed.search, hash: parsed.hash };
}

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

// -- Tests --------------------------------------------------------------------

describe("bootEntryPath", () => {
  it("sends a Better Lyrics link at the root to the editor with its params", () => {
    expect(bootEntryPath(at("/?v=dX3k_QDnzHE"), false)).toBe("/editor?v=dX3k_QDnzHE");
    expect(bootEntryPath(at("/?title=Midnight%20City&videoId=dX3k_QDnzHE"), false)).toBe(
      "/editor?title=Midnight%20City&videoId=dX3k_QDnzHE",
    );
  });

  it("sends a converter import at the root to the editor with its hash", () => {
    expect(bootEntryPath(at("/#import=%7B%7D"), false)).toBe("/editor#import=%7B%7D");
  });

  it("opens the editor at the root when the user asked to reopen the last project", () => {
    expect(bootEntryPath(at("/"), true)).toBe("/editor");
  });

  describe("edge cases", () => {
    it("leaves a plain root visit on the library", () => {
      expect(bootEntryPath(at("/"), false)).toBeNull();
      expect(bootEntryPath(at("/?utm_source=x"), false)).toBeNull();
    });

    it("never rewrites another page", () => {
      expect(bootEntryPath(at("/editor?v=x"), true)).toBeNull();
      expect(bootEntryPath(at("/recover"), true)).toBeNull();
      expect(bootEntryPath(at("/ttml-maker?v=x"), false)).toBeNull();
    });
  });
});

describe("redirectBootEntry", () => {
  it("rewrites the URL in place without adding a history entry", () => {
    window.history.replaceState(null, "", "/?v=dX3k_QDnzHE");
    const length = window.history.length;
    redirectBootEntry();
    expect(window.location.pathname).toBe("/editor");
    expect(window.location.search).toBe("?v=dX3k_QDnzHE");
    expect(window.history.length).toBe(length);
  });

  it("reads the launch setting", () => {
    useSettingsStore.setState({ launchScreen: "last-project" });
    window.history.replaceState(null, "", "/");
    redirectBootEntry();
    expect(window.location.pathname).toBe("/editor");
  });

  it("leaves the library alone by default", () => {
    window.history.replaceState(null, "", "/");
    redirectBootEntry();
    expect(window.location.pathname).toBe("/");
  });
});
