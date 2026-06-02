import { beforeEach, describe, expect, it } from "vitest";
import {
  clearGeneratorRegistry,
  registerGeneratorFactory,
  type RomanizationGenerator,
} from "@/domain/romanization/registry";
import { markPersistenceSettled } from "@/lib/persistence-settled";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { clearGeneratorCacheForTests } from "@/utils/romanization/generate-for-line";
import { EditPanel } from "@/views/edit";

// -- Helpers ------------------------------------------------------------------

function buildPassthroughGenerator(scheme: string): RomanizationGenerator {
  return {
    scheme,
    async generateLine(line) {
      return { text: `r:${line.text}` };
    },
  };
}

function seedJapaneseLines(): void {
  useProjectStore.setState({
    lines: [
      createLine({ id: "L1", text: "夜だけど" }),
      createLine({ id: "L2", text: "メモリー" }),
      createLine({ id: "L3", text: "hello" }),
    ],
  });
}

// -- Tests --------------------------------------------------------------------

describe("EditPanel romanization banner", () => {
  beforeEach(() => {
    markPersistenceSettled();
  });

  it("renders the banner when non-latin lines exist and scheme is unset", async () => {
    seedJapaneseLines();
    const screen = await render(<EditPanel />);
    await expect.element(screen.getByRole("region", { name: /romanization/i })).toBeInTheDocument();
    expect(screen.container.textContent).toContain("Japanese");
    expect(screen.container.textContent).toContain("2 lines");
  });

  it("hides the banner when only latin lines exist", async () => {
    useProjectStore.setState({
      lines: [createLine({ id: "L1", text: "hello" }), createLine({ id: "L2", text: "world" })],
    });
    const screen = await render(<EditPanel />);
    expect(screen.container.querySelector('[aria-label="Romanization suggestion"]')).toBeNull();
  });

  it("hides the banner when a scheme is already set", async () => {
    seedJapaneseLines();
    useProjectStore.getState().setRomanizationScheme("ja-Latn-hepburn");
    const screen = await render(<EditPanel />);
    expect(screen.container.querySelector('[aria-label="Romanization suggestion"]')).toBeNull();
  });

  it("hides the banner after dismissal and the dismissal flag persists in metadata", async () => {
    seedJapaneseLines();
    const screen = await render(<EditPanel />);

    const dismiss = screen.getByRole("button", { name: /dismiss romanization/i });
    await dismiss.click();

    await expect.poll(() => useProjectStore.getState().metadata.romanizationBannerDismissed).toBe(true);
    expect(screen.container.querySelector('[aria-label="Romanization suggestion"]')).toBeNull();
  });

  it("kicks off generation, fills line romanization, then auto-hides", async () => {
    clearGeneratorRegistry();
    registerGeneratorFactory("ja-Latn-hepburn", async () => buildPassthroughGenerator("ja-Latn-hepburn"));
    seedJapaneseLines();

    const screen = await render(<EditPanel />);

    const generate = screen.getByRole("button", { name: /generate/i });
    await generate.click();

    await expect.poll(() => useProjectStore.getState().metadata.romanizationScheme).toBe("ja-Latn-hepburn");
    await expect
      .poll(() => useProjectStore.getState().lines.find((l) => l.id === "L1")?.romanization?.text)
      .toBe("r:夜だけど");
    await expect.poll(() => screen.container.querySelector('[aria-label="Romanization suggestion"]')).toBeNull();

    clearGeneratorRegistry();
  });

  it("aborts in-flight generation when Dismiss is clicked mid-batch", async () => {
    clearGeneratorRegistry();
    clearGeneratorCacheForTests();
    let releaseFirstLine: () => void = () => undefined;
    const firstLineGate = new Promise<void>((resolve) => {
      releaseFirstLine = resolve;
    });
    let linesProcessed = 0;
    registerGeneratorFactory("ja-Latn-hepburn", async () => ({
      scheme: "ja-Latn-hepburn",
      async generateLine(line) {
        linesProcessed += 1;
        if (linesProcessed === 1) await firstLineGate;
        return { text: `r:${line.text}` };
      },
    }));
    seedJapaneseLines();

    const screen = await render(<EditPanel />);

    const generate = screen.getByRole("button", { name: /generate/i });
    await generate.click();

    await expect.poll(() => linesProcessed).toBeGreaterThanOrEqual(1);

    const dismiss = screen.getByRole("button", { name: /dismiss romanization/i });
    await dismiss.click();

    await expect.poll(() => useProjectStore.getState().metadata.romanizationBannerDismissed).toBe(true);

    releaseFirstLine();

    await expect.poll(() => useProjectStore.getState().lines.filter((l) => l.romanization).length).toBe(0);
    expect(linesProcessed).toBeLessThan(2);

    clearGeneratorRegistry();
  });
});

describe("EditPanel romanization banner invariants", () => {
  beforeEach(() => {
    markPersistenceSettled();
  });

  it("never appears when both scheme is set and dismissal is true", async () => {
    seedJapaneseLines();
    useProjectStore.getState().setRomanizationScheme("ja-Latn-hepburn");
    useProjectStore.getState().dismissRomanizationBanner();
    const screen = await render(<EditPanel />);
    expect(screen.container.querySelector('[aria-label="Romanization suggestion"]')).toBeNull();
  });

  it("never appears for an empty project", async () => {
    useProjectStore.setState({ lines: [] });
    const screen = await render(<EditPanel />);
    expect(screen.container.querySelector('[aria-label="Romanization suggestion"]')).toBeNull();
  });
});
