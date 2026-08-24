import { describe, expect, it } from "vitest";
import { BEST_PRACTICE_GROUPS } from "@/best-practices/groups";
import { render } from "@/test/render";
import { HelpSectionContent } from "@/ui/help-sections";
import { BestPracticesSection } from "@/ui/help-sections/best-practices";

// -- Helpers -------------------------------------------------------------------

function comesBefore(first: Element, second: Element): boolean {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function chipLabels(container: Element): (string | null)[] {
  return Array.from(container.querySelectorAll("li")).map((chip) => chip.textContent);
}

// -- Best practices section ----------------------------------------------------

describe("BestPracticesSection", () => {
  it("opens with the framing that none of this is enforced", async () => {
    const screen = await render(<BestPracticesSection />);
    await expect.element(screen.getByText(/None of this is enforced/i)).toBeInTheDocument();
  });

  it("renders the rule groups", async () => {
    const screen = await render(<BestPracticesSection />);
    await expect.element(screen.getByRole("heading", { name: "Background vocals", exact: true })).toBeInTheDocument();
    await expect.element(screen.getByRole("heading", { name: "Syllables", exact: true })).toBeInTheDocument();
  });

  it("is reachable through the section router", async () => {
    const screen = await render(<HelpSectionContent section="best-practices" />);
    await expect.element(screen.getByRole("heading", { name: "Lines and text", exact: true })).toBeInTheDocument();
  });

  it("indexes the five groups as chips", async () => {
    const screen = await render(<BestPracticesSection />);
    await expect.element(screen.getByRole("list", { name: "Rule groups" })).toBeInTheDocument();
    expect(chipLabels(screen.container)).toEqual(BEST_PRACTICE_GROUPS.map((group) => group.label));
  });

  it("renders every rule card", async () => {
    const screen = await render(<BestPracticesSection />);
    expect(screen.container.querySelectorAll("article").length).toBe(17);
  });
});

// -- Edge cases ----------------------------------------------------------------

describe("BestPracticesSection edge cases", () => {
  it("numbers neither the chips nor the group headings", async () => {
    const screen = await render(<BestPracticesSection />);
    for (const label of chipLabels(screen.container)) expect(label ?? "").not.toMatch(/^\s*\d/);
    for (const heading of screen.container.querySelectorAll("h3")) {
      expect(heading.textContent ?? "").not.toMatch(/^\s*\d/);
    }
  });

  it("adds no heading of its own above the group headings", async () => {
    const screen = await render(<BestPracticesSection />);
    const levels = Array.from(screen.container.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((heading) =>
      Number(heading.tagName.slice(1)),
    );
    expect(new Set(levels)).toEqual(new Set([3, 4]));
  });
});

// -- Invariants ----------------------------------------------------------------

describe("BestPracticesSection invariants", () => {
  it("restates no rule copy", async () => {
    const screen = await render(<BestPracticesSection />);
    const text = screen.container.textContent ?? "";
    for (const rule of BEST_PRACTICE_GROUPS.flatMap((group) => group.rules)) {
      expect(text.split(rule.title).length - 1).toBe(1);
      for (const paragraph of rule.body) expect(text.split(paragraph).length - 1).toBe(1);
    }
  });

  it("places the framing above the chips and the chips above the first rule", async () => {
    const screen = await render(<BestPracticesSection />);
    const intro = screen.getByText(/None of this is enforced/i).element();
    const chips = screen.getByRole("list", { name: "Rule groups" }).element();
    const firstCard = screen.container.querySelector("article");
    expect(firstCard).not.toBeNull();
    expect(comesBefore(intro, chips)).toBe(true);
    expect(comesBefore(chips, firstCard as Element)).toBe(true);
  });

  it("keeps the chips in registry order alongside the group headings", async () => {
    const screen = await render(<BestPracticesSection />);
    const headings = Array.from(screen.container.querySelectorAll("h3")).map((heading) => heading.textContent);
    expect(chipLabels(screen.container)).toEqual(headings);
  });
});
