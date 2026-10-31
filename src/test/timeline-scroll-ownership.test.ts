import { describe, expect, it } from "vitest";
import { findProductionMatches } from "@/test/source-files";

// Raw scroller access forces layout mid-frame or leaves view-scroll.ts's cached position stale.

// -- Constants ----------------------------------------------------------------

const OWNER = "views/timeline/view-scroll.ts";
const SNAPSHOT_RECEIVERS = "s|state|prev|previous|view|frame|next|a|b|start|pointer";
const RAW_SCROLL_ACCESS = new RegExp(
  [
    `(?<!\\b(?:${SNAPSHOT_RECEIVERS})\\??|(?:get|getState)\\(\\))\\.scroll(?:Left|Top)\\b`,
    `\\{[^{}]*\\bscroll(?:Left|Top)\\b[^{}]*\\}\\s*=\\s*(?!(?:${SNAPSHOT_RECEIVERS})\\s*;)[\\w.?]+\\s*;`,
    "\\.scroll(?:To|By)?\\(",
    "\\bscrollIntoView\\(",
  ].join("|"),
);

// -- Tests --------------------------------------------------------------------

describe("timeline scroll ownership", () => {
  it("touches the Timeline scroller only through view-scroll.ts", () => {
    const offenders = findProductionMatches(
      RAW_SCROLL_ACCESS,
      (relPath) => !relPath.startsWith("views/timeline/") || relPath === OWNER,
    );
    expect(offenders).toEqual([]);
  });
});
