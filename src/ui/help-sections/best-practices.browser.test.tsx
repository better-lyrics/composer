import { cdp, userEvent } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { groupAnchorId } from "@/best-practices/anchors";
import { BEST_PRACTICE_GROUPS } from "@/best-practices/groups";
import { comesBefore } from "@/test/dom-order";
import { render } from "@/test/render";
import { HelpSectionContent } from "@/ui/help-sections";
import { BestPracticesSection } from "@/ui/help-sections/best-practices";

// -- Helpers -------------------------------------------------------------------

type Screen = Awaited<ReturnType<typeof render>>;

function chipLabels(container: Element): (string | null)[] {
  return Array.from(container.querySelectorAll("li button")).map((chip) => chip.textContent);
}

function anchorFor(groupId: string): HTMLElement {
  const heading = document.getElementById(groupAnchorId(groupId));
  if (!heading) throw new Error(`No heading anchored at ${groupAnchorId(groupId)}`);
  return heading;
}

function recordScrollIntoView(element: Element): ScrollIntoViewOptions[] {
  const calls: ScrollIntoViewOptions[] = [];
  element.scrollIntoView = (options?: boolean | ScrollIntoViewOptions) => {
    if (typeof options === "object") calls.push(options);
  };
  return calls;
}

// Motion caches the preference in a module global refreshed only by the media
// query change event, so settle on the event rather than on matchMedia.
async function emulateReducedMotion(value: "reduce" | "no-preference"): Promise<void> {
  const query = window.matchMedia("(prefers-reduced-motion)");
  if (query.matches === (value === "reduce")) return;
  const settled = new Promise<void>((resolve) => query.addEventListener("change", () => resolve(), { once: true }));
  await cdp().send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value }] });
  await settled;
}

async function clickEveryChip(screen: Screen): Promise<Map<string, ScrollIntoViewOptions[]>> {
  const calls = new Map<string, ScrollIntoViewOptions[]>();
  for (const group of BEST_PRACTICE_GROUPS) calls.set(group.id, recordScrollIntoView(anchorFor(group.id)));
  for (const group of BEST_PRACTICE_GROUPS) {
    await screen.getByRole("button", { name: group.label, exact: true }).click();
  }
  return calls;
}

// -- Best practices section ----------------------------------------------------

describe("BestPracticesSection", () => {
  it("opens with the framing that none of this is enforced", async () => {
    const screen = await render(<BestPracticesSection />);
    await expect.element(screen.getByText(/Nothing here is enforced/i)).toBeInTheDocument();
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

// -- Chips as an index ---------------------------------------------------------

describe("BestPracticesSection chips", () => {
  it("offers every chip as a button named after its group", async () => {
    const screen = await render(<BestPracticesSection />);
    for (const group of BEST_PRACTICE_GROUPS) {
      const chip = screen.getByRole("button", { name: group.label, exact: true });
      await expect.element(chip).toBeInTheDocument();
      expect(chip.element().tagName).toBe("BUTTON");
    }
  });

  it("scrolls each group heading into view from its own chip", async () => {
    const screen = await render(<BestPracticesSection />);
    const calls = await clickEveryChip(screen);
    for (const group of BEST_PRACTICE_GROUPS) {
      expect(calls.get(group.id)).toHaveLength(1);
      expect(calls.get(group.id)?.[0]?.block).toBe("start");
    }
  });

  it("animates the scroll when the reader states no motion preference", async () => {
    const screen = await render(<BestPracticesSection />);
    const calls = await clickEveryChip(screen);
    for (const group of BEST_PRACTICE_GROUPS) expect(calls.get(group.id)?.[0]?.behavior).toBe("smooth");
  });

  it("jumps without animation when the reader prefers reduced motion", async () => {
    await emulateReducedMotion("reduce");
    try {
      const screen = await render(<BestPracticesSection />);
      const calls = await clickEveryChip(screen);
      for (const group of BEST_PRACTICE_GROUPS) expect(calls.get(group.id)?.[0]?.behavior).toBe("auto");
    } finally {
      await emulateReducedMotion("no-preference");
    }
  });

  it("puts the first chip in the tab order", async () => {
    const screen = await render(<BestPracticesSection />);
    const first = screen.getByRole("button", { name: BEST_PRACTICE_GROUPS[0]?.label ?? "", exact: true });
    (document.activeElement as HTMLElement | null)?.blur();
    await expect.poll(() => document.activeElement).toBe(document.body);
    await userEvent.tab();
    await expect.poll(() => document.activeElement).toBe(first.element());
  });

  it("activates a chip from the keyboard", async () => {
    const screen = await render(<BestPracticesSection />);
    const group = BEST_PRACTICE_GROUPS[0];
    const calls = recordScrollIntoView(anchorFor(group?.id ?? ""));
    const chip = screen.getByRole("button", { name: group?.label ?? "", exact: true });
    (chip.element() as HTMLElement).focus();
    await expect.poll(() => document.activeElement).toBe(chip.element());
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => calls.length).toBe(1);
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
    const intro = screen.getByText(/Nothing here is enforced/i).element();
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
