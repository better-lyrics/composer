import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { clearHelpMatches, filterHelpTopics, paintHelpMatches } from "@/ui/help-search/filter-help-topics";
import { HelpSectionContent } from "@/ui/help-sections";
import { HelpTopic } from "@/ui/help-topic";

// -- Fixtures ------------------------------------------------------------------

const ResultSection: React.FC<{ id: string; label: string; children: React.ReactNode }> = ({ id, label, children }) => (
  <div data-help-result-section={id} data-help-section-label={label}>
    <h3>{label}</h3>
    <div data-help-result-body>{children}</div>
  </div>
);

async function renderResults() {
  const screen = await render(
    <div>
      <ResultSection id="timeline" label="Timeline">
        <HelpSectionContent section="timeline" />
      </ResultSection>
      <ResultSection id="recovery" label="Recovery">
        <HelpSectionContent section="recovery" />
      </ResultSection>
    </div>,
  );
  return screen.container.firstElementChild as HTMLElement;
}

const topic = (root: HTMLElement, title: string) =>
  root.querySelector<HTMLElement>(`[data-help-topic="${CSS.escape(title)}"]`);
const section = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(`[data-help-result-section="${id}"]`);
const visibleTopics = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>("[data-help-topic]")]
    .filter((element) => element.closest("[hidden]") === null)
    .map((element) => element.dataset.helpTopic);

// -- Tests ---------------------------------------------------------------------

describe("filterHelpTopics", () => {
  it("keeps matching topics, hides the rest, and counts per section", async () => {
    const root = await renderResults();
    const counts = filterHelpTopics(root, ["snap"]);
    expect(topic(root, "Snap (magnet)")?.hidden).toBe(false);
    expect(topic(root, "Layout")?.hidden).toBe(true);
    expect(counts.timeline).toBe(visibleTopics(root).length);
    expect(counts.recovery).toBeUndefined();
    expect(section(root, "recovery")?.hidden).toBe(true);
  });

  it("requires every term to match within one topic", async () => {
    const root = await renderResults();
    filterHelpTopics(root, ["snap", "threshold"]);
    expect(visibleTopics(root)).toEqual(["Snap (magnet)"]);
  });

  it("matches every topic of a section by its label", async () => {
    const root = await renderResults();
    const counts = filterHelpTopics(root, ["recovery"]);
    expect(counts.recovery).toBe(
      root.querySelectorAll('[data-help-result-section="recovery"] [data-help-topic]').length,
    );
  });

  it("hides content outside topics, like section intros", async () => {
    const root = await renderResults();
    filterHelpTopics(root, ["snap"]);
    const intro = section(root, "timeline")?.querySelector("[data-help-result-body] > * > p");
    expect(intro?.closest("[hidden]")).not.toBeNull();
  });

  describe("edge cases", () => {
    it("ignores text marked as not searchable", async () => {
      const screen = await render(
        <ResultSection id="about" label="About">
          <HelpTopic title="Credits">
            <p>Built for Better Lyrics.</p>
            <button type="button" data-search-ignore>
              Open
            </button>
          </HelpTopic>
        </ResultSection>,
      );
      expect(filterHelpTopics(screen.container, ["open"])).toEqual({});
    });

    it("hides every section when nothing matches", async () => {
      const root = await renderResults();
      expect(filterHelpTopics(root, ["zzzqqq"])).toEqual({});
      expect(section(root, "timeline")?.hidden).toBe(true);
    });
  });

  describe("invariants", () => {
    it("restores topics a previous query hid", async () => {
      const root = await renderResults();
      filterHelpTopics(root, ["snap"]);
      filterHelpTopics(root, ["frozen"]);
      expect(visibleTopics(root)).toContain("The app is frozen");
      for (const title of visibleTopics(root)) expect(topic(root, title ?? "")?.textContent).toMatch(/frozen/i);
      expect(section(root, "timeline")?.hidden).toBe(true);
      expect(section(root, "recovery")?.hidden).toBe(false);
    });
  });
});

describe("paintHelpMatches", () => {
  it("highlights every occurrence inside visible topics only", async () => {
    const root = await renderResults();
    filterHelpTopics(root, ["frozen"]);
    paintHelpMatches(root, ["frozen"]);
    const ranges = [...(CSS.highlights.get("help-match") ?? [])] as Range[];
    expect(ranges.length).toBeGreaterThan(0);
    for (const range of ranges) {
      expect(range.toString().toLowerCase()).toBe("frozen");
      expect(range.startContainer.parentElement?.closest("[hidden]")).toBeNull();
    }
  });

  it("clears the highlight", async () => {
    const root = await renderResults();
    paintHelpMatches(root, ["snap"]);
    clearHelpMatches();
    expect(CSS.highlights.has("help-match")).toBe(false);
  });
});
