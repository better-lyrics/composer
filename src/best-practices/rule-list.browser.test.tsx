import { describe, expect, it } from "vitest";
import { groupAnchorId } from "@/best-practices/anchors";
import { BEST_PRACTICE_GROUPS } from "@/best-practices/groups";
import { RuleList } from "@/best-practices/rule-list";
import { render } from "@/test/render";

// -- Helpers -------------------------------------------------------------------

interface OutlineEntry {
  level: number;
  text: string;
}

const EXPECTED_OUTLINE: OutlineEntry[] = BEST_PRACTICE_GROUPS.flatMap((group) => [
  { level: 3, text: group.label },
  ...group.rules.map((rule) => ({ level: 4, text: rule.title })),
]);

function headingOutline(container: Element): OutlineEntry[] {
  return Array.from(container.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((heading) => ({
    level: Number(heading.tagName.slice(1)),
    text: heading.textContent ?? "",
  }));
}

function groupHeadings(container: Element): string[] {
  return Array.from(container.querySelectorAll("h3")).map((heading) => heading.textContent ?? "");
}

// -- Rule list -----------------------------------------------------------------

describe("RuleList", () => {
  it("renders a heading for every group", async () => {
    const screen = await render(<RuleList />);
    for (const group of BEST_PRACTICE_GROUPS) {
      await expect.element(screen.getByRole("heading", { name: group.label, exact: true })).toBeInTheDocument();
    }
  });

  it("renders every rule title", async () => {
    const screen = await render(<RuleList />);
    for (const rule of BEST_PRACTICE_GROUPS.flatMap((g) => g.rules)) {
      await expect.element(screen.getByRole("heading", { name: rule.title, exact: true })).toBeInTheDocument();
    }
  });

  it("renders one card per rule", async () => {
    const screen = await render(<RuleList />);
    expect(screen.container.querySelectorAll("article").length).toBe(17);
  });

  it("orders the group headings the way the registry orders them", async () => {
    const screen = await render(<RuleList />);
    expect(groupHeadings(screen.container)).toEqual(BEST_PRACTICE_GROUPS.map((group) => group.label));
  });

  it("nests every rule title under the group heading that owns it", async () => {
    const screen = await render(<RuleList />);
    expect(headingOutline(screen.container)).toEqual(EXPECTED_OUTLINE);
  });

  it("anchors every group heading under the id its own registry entry derives", async () => {
    const screen = await render(<RuleList />);
    for (const group of BEST_PRACTICE_GROUPS) {
      const heading = screen.container.querySelector(`#${CSS.escape(groupAnchorId(group.id))}`);
      expect(heading?.tagName).toBe("H3");
      expect(heading?.textContent).toBe(group.label);
    }
  });

  it("names each group section by its heading", async () => {
    const screen = await render(<RuleList />);
    const sections = screen.container.querySelectorAll("section[aria-labelledby]");
    expect(sections.length).toBe(BEST_PRACTICE_GROUPS.length);
    for (const [index, section] of Array.from(sections).entries()) {
      const labelId = section.getAttribute("aria-labelledby");
      const heading = labelId ? screen.container.querySelector(`#${CSS.escape(labelId)}`) : null;
      expect(heading?.textContent).toBe(BEST_PRACTICE_GROUPS[index]?.label);
    }
  });
});

// -- Edge cases ----------------------------------------------------------------

describe("RuleList edge cases", () => {
  it("leaves no group heading standing without rules under it", async () => {
    const screen = await render(<RuleList />);
    const outline = headingOutline(screen.container);
    for (const [index, entry] of outline.entries()) {
      if (entry.level !== 3) continue;
      expect(outline[index + 1]?.level).toBe(4);
    }
  });

  it("renders the comparison block only for the rules that carry an example", async () => {
    const screen = await render(<RuleList />);
    const withExamples = BEST_PRACTICE_GROUPS.flatMap((group) => group.rules).filter((rule) => rule.example);
    expect(screen.container.querySelectorAll("[data-rule-example]").length).toBe(withExamples.length);
  });

  it("renders the longest rule title in full", async () => {
    const screen = await render(<RuleList />);
    const longest = BEST_PRACTICE_GROUPS.flatMap((group) => group.rules)
      .map((rule) => rule.title)
      .reduce((winner, title) => (title.length > winner.length ? title : winner), "");
    await expect.element(screen.getByRole("heading", { name: longest, exact: true })).toBeInTheDocument();
  });
});

// -- Invariants ----------------------------------------------------------------

describe("RuleList invariants", () => {
  it("prefixes no group heading with a number", async () => {
    const screen = await render(<RuleList />);
    for (const heading of groupHeadings(screen.container)) expect(heading).not.toMatch(/^\s*\d/);
  });

  it("pairs the bottom spacing of every group heading with a matching scroll margin", async () => {
    // Asserted as classes rather than computed style: the browser project loads
    // no stylesheet, so getComputedStyle would only read UA defaults here.
    const screen = await render(<RuleList />);
    for (const heading of screen.container.querySelectorAll("h3")) {
      const classes = Array.from(heading.classList);
      const bottomSpacing = classes.find((name) => name.startsWith("mb-"));
      expect(bottomSpacing).toBeDefined();
      expect(classes).toContain(`scroll-mt-${bottomSpacing?.slice("mb-".length)}`);
    }
  });

  it("gives every group heading a unique, non-empty anchor id", async () => {
    const screen = await render(<RuleList />);
    const ids = Array.from(screen.container.querySelectorAll("h3")).map((heading) => heading.id);
    expect(ids).toEqual(BEST_PRACTICE_GROUPS.map((group) => groupAnchorId(group.id)));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("renders each group heading exactly once", async () => {
    const screen = await render(<RuleList />);
    const headings = groupHeadings(screen.container);
    expect(new Set(headings).size).toBe(headings.length);
  });

  it("renders every rule title exactly once", async () => {
    const screen = await render(<RuleList />);
    const text = screen.container.textContent ?? "";
    for (const rule of BEST_PRACTICE_GROUPS.flatMap((group) => group.rules)) {
      expect(text.split(rule.title).length - 1).toBe(1);
    }
  });

  it("skips no heading level between a group and its rules", async () => {
    const screen = await render(<RuleList />);
    const levels = headingOutline(screen.container).map((entry) => entry.level);
    expect(new Set(levels)).toEqual(new Set([3, 4]));
  });
});
