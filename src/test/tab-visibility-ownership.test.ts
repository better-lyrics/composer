import { matchLines, productionSources } from "@/test/source-scan";
import { describe, expect, it } from "vitest";

// A panel that compares activeTab itself re-renders on every tab switch and tends to keep working while hidden.
// A `getState().activeTab` check inside a handler is a gate, not a render read, so it is not matched.

// -- Constants ----------------------------------------------------------------

const ACTIVE_TAB_COMPARISON = /(?<!getState\(\)\.)\bactiveTab\s*[!=]==\s*["'`]/;

const ALLOWED_TAB_READS = new Map<string, string>([
  ["views/editor-screen.tsx", "the shell decides which panel renders"],
  ["hooks/use-is-active-tab.ts", "the owner of the per-panel visibility read"],
  [
    "views/languages.tsx",
    "drops a finished generation when the user left the tab; a getState snapshot, not a render read",
  ],
]);

// -- Tests --------------------------------------------------------------------

describe("tab visibility has one read", () => {
  it("compares activeTab with a tab name only in the listed files", () => {
    const offenders = productionSources("views", "ui").flatMap(({ relPath, code }) =>
      ALLOWED_TAB_READS.has(relPath)
        ? []
        : matchLines(code, ACTIVE_TAB_COMPARISON).map((line) => `src/${relPath}:${line}`),
    );
    expect(
      offenders.length === 0
        ? ""
        : [
            ...offenders,
            "Ask whether this panel is visible with useIsActiveTab(tab) (hooks/use-is-active-tab.ts).",
            "Hidden panels are not rendered by the shell (views/editor-screen.tsx), so most panels need no check at all.",
          ].join("\n"),
    ).toBe("");
  });
});
