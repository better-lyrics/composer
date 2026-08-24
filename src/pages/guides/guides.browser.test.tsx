import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { BEST_PRACTICE_GROUPS } from "@/best-practices/groups";
import { groupAnchorId } from "@/best-practices/rule-list";
import BackgroundVocalsContent from "@/pages/guides/content/background-vocals-in-ttml";
import AppleMusicLyricsContent from "@/pages/guides/content/how-to-make-apple-music-synced-lyrics";
import KaraokeContent from "@/pages/guides/content/karaoke-style-lyrics-guide";
import LrcToTtmlContent from "@/pages/guides/content/lrc-to-ttml-conversion-guide";
import LyricBestPracticesContent from "@/pages/guides/content/lyric-best-practices";
import MultiAgentContent from "@/pages/guides/content/multi-agent-lyrics-duets";
import TtmlSpecContent from "@/pages/guides/content/ttml-file-format-spec";
import TtmlVsLrcContent from "@/pages/guides/content/ttml-vs-lrc";
import WhatIsTtmlContent from "@/pages/guides/content/what-is-ttml";
import GuidesIndexPage from "@/pages/guides/guides-index";
import GuidePage from "@/pages/guides/guide-page";

const CONTENT_COMPONENTS = [
  ["BackgroundVocals", BackgroundVocalsContent],
  ["AppleMusicLyrics", AppleMusicLyricsContent],
  ["Karaoke", KaraokeContent],
  ["LrcToTtml", LrcToTtmlContent],
  ["LyricBestPractices", LyricBestPracticesContent],
  ["MultiAgent", MultiAgentContent],
  ["TtmlSpec", TtmlSpecContent],
  ["TtmlVsLrc", TtmlVsLrcContent],
  ["WhatIsTtml", WhatIsTtmlContent],
] as const;

describe("Guide content components", () => {
  for (const [name, Content] of CONTENT_COMPONENTS) {
    it(`${name} renders prose without crashing`, async () => {
      const screen = await render(<Content />);
      expect(screen.container.textContent ?? "").not.toBe("");
    });
  }
});

describe("Guide index and page modules", () => {
  it("guides-index exports a default page component", () => {
    expect(typeof GuidesIndexPage).toBe("function");
  });

  it("guide-page exports a default page component", () => {
    expect(typeof GuidePage).toBe("function");
  });
});

describe("Lyric best practices guide", () => {
  it("renders every rule group", async () => {
    const screen = await render(<LyricBestPracticesContent />);
    for (const group of BEST_PRACTICE_GROUPS) {
      await expect.element(screen.getByRole("heading", { name: group.label, exact: true })).toBeInTheDocument();
    }
  });

  it("links its contents at the anchors the rule list assigns", async () => {
    const screen = await render(<LyricBestPracticesContent />);
    for (const group of BEST_PRACTICE_GROUPS) {
      const link = screen.container.querySelector(`a[href="#${groupAnchorId(group.id)}"]`);
      expect(link, `missing contents link for ${group.id}`).not.toBeNull();
      expect(screen.container.querySelector(`#${groupAnchorId(group.id)}`)).not.toBeNull();
    }
  });

  it("renders the rule list rather than restating its copy", async () => {
    const screen = await render(<LyricBestPracticesContent />);
    const rules = BEST_PRACTICE_GROUPS.flatMap((group) => group.rules);
    expect(rules).toHaveLength(17);
    for (const rule of rules) {
      await expect.element(screen.getByRole("heading", { name: rule.title, exact: true })).toBeInTheDocument();
    }
  });
});
