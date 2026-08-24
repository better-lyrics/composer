import { describe, expect, it } from "vitest";
import { LyricSample } from "@/best-practices/examples";
import type { Rule } from "@/best-practices/model";
import { RuleCard } from "@/best-practices/rule-card";
import { render } from "@/test/render";

// -- Fixtures ------------------------------------------------------------------

const TEXT_ONLY: Rule = {
  id: "doubling",
  title: "Transcribe doubling only when you can hear it clearly",
  body: ["First paragraph.", "Second paragraph."],
};

const WITH_ASIDE: Rule = {
  id: "sentence-case",
  title: "Sentence case, no full stop",
  body: ["Capital at the start."],
  aside: "Treat that as a default and not much more.",
};

const WITH_EXAMPLE: Rule = {
  id: "brackets",
  title: "Backgrounds carry brackets",
  body: ["Not required."],
  example: { wrong: <span>ooh yeah</span>, right: <span>(ooh yeah)</span> },
};

const WITH_ASIDE_AND_EXAMPLE: Rule = {
  id: "one-pair",
  title: "One pair of brackets for the whole run",
  body: ["Two background snippets in the same line share one outer pair."],
  aside: "Preserve brackets when extracting does this for you.",
  example: {
    wrong: <LyricSample lines={[{ main: "Running through the night", background: "(ooh yeah) (ooh yeah)" }]} />,
    right: <LyricSample lines={[{ main: "Running through the night", background: "(ooh yeah, ooh yeah)" }]} />,
  },
};

// -- Helpers -------------------------------------------------------------------

function comesBefore(first: Element, second: Element): boolean {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function exampleKinds(container: Element): (string | null)[] {
  return Array.from(container.querySelectorAll("[data-example-kind]")).map((row) =>
    row.getAttribute("data-example-kind"),
  );
}

function exampleRow(container: Element, kind: "wrong" | "right"): Element {
  const row = container.querySelector(`[data-example-kind="${kind}"]`);
  if (!row) throw new Error(`No ${kind} example row rendered`);
  return row;
}

// -- Rule card -----------------------------------------------------------------

describe("RuleCard", () => {
  it("renders the title as a heading", async () => {
    const screen = await render(<RuleCard rule={TEXT_ONLY} />);
    await expect.element(screen.getByRole("heading", { name: TEXT_ONLY.title })).toBeInTheDocument();
  });

  it("renders every body paragraph", async () => {
    const screen = await render(<RuleCard rule={TEXT_ONLY} />);
    await expect.element(screen.getByText("First paragraph.")).toBeInTheDocument();
    await expect.element(screen.getByText("Second paragraph.")).toBeInTheDocument();
  });

  it("renders the aside when one is present", async () => {
    const screen = await render(<RuleCard rule={WITH_ASIDE} />);
    await expect.element(screen.getByText(WITH_ASIDE.aside as string)).toBeInTheDocument();
  });

  it("omits the comparison block for a text-only rule", async () => {
    const screen = await render(<RuleCard rule={TEXT_ONLY} />);
    expect(screen.container.querySelector("[data-rule-example]")).toBeNull();
  });

  it("renders the wrong example before the right one", async () => {
    const screen = await render(<RuleCard rule={WITH_EXAMPLE} />);
    expect(exampleKinds(screen.container)).toEqual(["wrong", "right"]);
  });

  it("labels each example for assistive tech", async () => {
    const screen = await render(<RuleCard rule={WITH_EXAMPLE} />);
    await expect.element(screen.getByText("Don't", { exact: true })).toBeInTheDocument();
    await expect.element(screen.getByText("Do", { exact: true })).toBeInTheDocument();
  });

  it("renders the content of both examples", async () => {
    const screen = await render(<RuleCard rule={WITH_EXAMPLE} />);
    await expect.element(screen.getByText("ooh yeah", { exact: true })).toBeInTheDocument();
    await expect.element(screen.getByText("(ooh yeah)", { exact: true })).toBeInTheDocument();
  });

  it("marks the example icons as decorative", async () => {
    const screen = await render(<RuleCard rule={WITH_EXAMPLE} />);
    const icons = screen.container.querySelectorAll("svg");
    expect(icons.length).toBe(2);
    for (const icon of icons) expect(icon.getAttribute("aria-hidden")).toBe("true");
  });
});

// -- Edge cases ----------------------------------------------------------------

describe("RuleCard edge cases", () => {
  it("renders a rule with an empty body as a title alone", async () => {
    const rule: Rule = { id: "bare", title: "Keep the pauses", body: [] };
    const screen = await render(<RuleCard rule={rule} />);
    await expect.element(screen.getByRole("heading", { name: "Keep the pauses" })).toBeInTheDocument();
    expect(screen.container.textContent).toBe("Keep the pauses");
  });

  it("renders a very long title in full", async () => {
    const title = "An ad-lib in a gap goes wherever it will not stretch a line, however far out the ad-lib lands";
    const screen = await render(<RuleCard rule={{ id: "gap-ad-lib", title, body: [] }} />);
    await expect.element(screen.getByRole("heading", { name: title })).toBeInTheDocument();
  });

  it("renders an example without an aside", async () => {
    const screen = await render(<RuleCard rule={WITH_EXAMPLE} />);
    expect(screen.container.querySelector("[data-rule-example]")).not.toBeNull();
    expect(screen.container.textContent).not.toContain("Treat that as a default");
  });

  it("renders both an aside and an example on the same rule", async () => {
    const screen = await render(<RuleCard rule={WITH_ASIDE_AND_EXAMPLE} />);
    await expect.element(screen.getByText(WITH_ASIDE_AND_EXAMPLE.aside as string)).toBeInTheDocument();
    expect(exampleKinds(screen.container)).toEqual(["wrong", "right"]);
  });

  it("renders example content built from the sample primitives", async () => {
    const screen = await render(<RuleCard rule={WITH_ASIDE_AND_EXAMPLE} />);
    await expect.element(screen.getByText("(ooh yeah) (ooh yeah)")).toBeInTheDocument();
    await expect.element(screen.getByText("(ooh yeah, ooh yeah)")).toBeInTheDocument();
  });

  it("keeps identical wrong and right content in separate rows", async () => {
    const rule: Rule = {
      id: "identical",
      title: "Two voices on one line is always a chorus",
      body: [],
      example: { wrong: <span>We were never gonna make it</span>, right: <span>We were never gonna make it</span> },
    };
    const screen = await render(<RuleCard rule={rule} />);
    expect(exampleRow(screen.container, "wrong").textContent).toContain("We were never gonna make it");
    expect(exampleRow(screen.container, "right").textContent).toContain("We were never gonna make it");
  });

  it("renders body copy carrying punctuation and non-latin characters verbatim", async () => {
    const paragraph = `${String.fromCharCode(0x4f60, 0x597d)}, where did you go, my love?`;
    const screen = await render(<RuleCard rule={{ id: "unicode", title: "Copy", body: [paragraph] }} />);
    await expect.element(screen.getByText(paragraph)).toBeInTheDocument();
  });

  it("renders repeated body paragraphs once each", async () => {
    const repeated = "Break where the singer breathes.";
    const screen = await render(<RuleCard rule={{ id: "repeat", title: "One breath", body: [repeated, repeated] }} />);
    expect((screen.container.textContent ?? "").split(repeated).length - 1).toBe(2);
  });
});

// -- Invariants ----------------------------------------------------------------

describe("RuleCard invariants", () => {
  it("places the title above the body copy", async () => {
    const screen = await render(<RuleCard rule={TEXT_ONLY} />);
    const title = screen.getByRole("heading", { name: TEXT_ONLY.title }).element();
    const body = screen.getByText("First paragraph.").element();
    expect(comesBefore(title, body)).toBe(true);
  });

  it("places the body copy above the comparison block", async () => {
    const screen = await render(<RuleCard rule={WITH_EXAMPLE} />);
    const body = screen.getByText("Not required.").element();
    const example = screen.container.querySelector("[data-rule-example]");
    expect(example).not.toBeNull();
    expect(comesBefore(body, example as Element)).toBe(true);
  });

  it("places the aside below the last body paragraph and above the comparison block", async () => {
    const screen = await render(<RuleCard rule={WITH_ASIDE_AND_EXAMPLE} />);
    const body = screen.getByText(WITH_ASIDE_AND_EXAMPLE.body[0]).element();
    const aside = screen.getByText(WITH_ASIDE_AND_EXAMPLE.aside as string).element();
    const example = exampleRow(screen.container, "wrong");
    expect(comesBefore(body, aside)).toBe(true);
    expect(comesBefore(aside, example)).toBe(true);
  });

  it("keeps body paragraphs in the order they are given", async () => {
    const screen = await render(<RuleCard rule={TEXT_ONLY} />);
    const first = screen.getByText("First paragraph.").element();
    const second = screen.getByText("Second paragraph.").element();
    expect(comesBefore(first, second)).toBe(true);
  });

  it("renders exactly one comparison block holding exactly two rows", async () => {
    const screen = await render(<RuleCard rule={WITH_EXAMPLE} />);
    expect(screen.container.querySelectorAll("[data-rule-example]").length).toBe(1);
    expect(screen.container.querySelectorAll("[data-example-kind]").length).toBe(2);
  });

  it("renders no example rows when the rule has no example", async () => {
    const screen = await render(<RuleCard rule={WITH_ASIDE} />);
    expect(exampleKinds(screen.container)).toEqual([]);
  });

  it("keeps each label inside the row it describes", async () => {
    const screen = await render(<RuleCard rule={WITH_EXAMPLE} />);
    const wrong = exampleRow(screen.container, "wrong");
    const right = exampleRow(screen.container, "right");
    expect(wrong.textContent).toContain("Don't");
    expect(wrong.textContent).toContain("ooh yeah");
    expect(right.textContent).toContain("Do");
    expect(right.textContent).toContain("(ooh yeah)");
    expect(wrong.textContent).not.toContain("(ooh yeah)");
  });

  it("keeps the wrong row above the right row for every rule carrying an example", async () => {
    for (const rule of [WITH_EXAMPLE, WITH_ASIDE_AND_EXAMPLE]) {
      const screen = await render(<RuleCard rule={rule} />);
      const wrong = exampleRow(screen.container, "wrong");
      const right = exampleRow(screen.container, "right");
      expect(comesBefore(wrong, right)).toBe(true);
      await screen.unmount();
    }
  });
});
