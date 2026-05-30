import { describe, expect, it } from "vitest";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { EditPanel } from "@/views/edit";

// -- Helpers ------------------------------------------------------------------

function seedJapaneseProject(): void {
  useProjectStore.setState({
    lines: [
      createLine({ id: "L1", text: "夜だけど" }),
      createLine({ id: "L2", text: "メモリー" }),
      createLine({ id: "L3", text: "hello" }),
    ],
  });
  useProjectStore.getState().setRomanizationScheme("ja-Latn-hepburn");
}

// -- Tests --------------------------------------------------------------------

describe("EditPanel romanization ghost state", () => {
  it("renders +Add ghost on non-latin lines that have no romanization yet", async () => {
    seedJapaneseProject();
    const screen = await render(<EditPanel />);
    const ghosts = [...screen.container.querySelectorAll('[data-testid="romanization-subrow"]')].filter((el) =>
      el.textContent?.includes("Add romanization"),
    );
    expect(ghosts.length).toBe(2);
  });

  it("never renders +Add ghost on a latin-only line", async () => {
    seedJapaneseProject();
    const screen = await render(<EditPanel />);
    const containingHello = [...screen.container.querySelectorAll("div")].find(
      (d) => d.querySelector('[data-testid="line-preview-text"]')?.textContent === "hello",
    );
    expect(containingHello?.querySelector('[data-testid="romanization-subrow"]')).toBeNull();
  });

  it("never renders +Add ghost when scheme is unset", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "L1", text: "夜だけど" })] });
    const screen = await render(<EditPanel />);
    expect(screen.container.querySelector('[data-testid="romanization-subrow"]')).toBeNull();
  });

  it("replaces the ghost with the filled subrow once the line has romanization", async () => {
    seedJapaneseProject();
    useProjectStore.getState().setLineRomanization("L1", { text: "yoru dakedo", source: "generated" });
    const screen = await render(<EditPanel />);
    const subrows = [...screen.container.querySelectorAll('[data-testid="romanization-subrow"]')].map(
      (el) => el.textContent ?? "",
    );
    expect(subrows).toContain("yoru dakedo");
    expect(subrows.filter((s) => s.includes("Add romanization")).length).toBe(1);
  });
});
