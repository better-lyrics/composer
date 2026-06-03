import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reconcileLine } from "@/domain/line/model";
import { RomanizationBanner } from "@/views/edit/romanization-banner";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { render } from "@/test/render";

// `runTurnstile` is the only piece we cannot exercise live - it loads a third
// party Cloudflare script and prompts a real challenge. The rest of the stack
// (banner, orchestrator, API client, store) runs for real.
vi.mock("@/utils/turnstile", () => ({
  runTurnstile: vi.fn(async () => "tok"),
}));

// -- Fixtures -----------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function seedJapaneseLines() {
  useProjectStore.setState(useProjectStore.getInitialState());
  useProjectStore.getState().setLinesWithHistory([
    reconcileLine({
      id: "L1",
      text: "夜だけど",
      agentId: "v1",
      words: [
        { text: "夜", begin: 0, end: 1 },
        { text: "だけど", begin: 1, end: 2 },
      ],
    }),
    reconcileLine({
      id: "L2",
      text: "朝が来るまで",
      agentId: "v1",
      words: [
        { text: "朝が", begin: 2, end: 3 },
        { text: "来るまで", begin: 3, end: 4 },
      ],
    }),
  ]);
}

function seedLatinLines() {
  useProjectStore.setState(useProjectStore.getInitialState());
  useProjectStore
    .getState()
    .setLinesWithHistory([reconcileLine({ id: "L1", text: "Hello world", agentId: "v1", begin: 0, end: 1 })]);
}

let fetchStub: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchStub = vi.fn();
  vi.stubGlobal("fetch", fetchStub);
  useSettingsStore.setState({ romanizationApiBase: "", romanizationTurnstileSiteKey: "test-key" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// -- Visibility ---------------------------------------------------------------

describe("RomanizationBanner visibility", () => {
  it("is hidden when no lines are eligible (all Latin)", async () => {
    seedLatinLines();
    const screen = await render(<RomanizationBanner />);
    await expect.element(screen.getByTestId("romanization-banner")).not.toBeInTheDocument();
  });

  it("is hidden when all eligible lines have romanization and metadata scheme is set", async () => {
    seedJapaneseLines();
    useProjectStore.getState().setMetadata({ romanizationScheme: "ja-Latn-hepburn" });
    useProjectStore.getState().setLineRomanizationWithHistory("L1", {
      text: "yoru dakedo",
      wordTexts: ["yoru", "dakedo"],
      source: "generated",
    });
    useProjectStore.getState().setLineRomanizationWithHistory("L2", {
      text: "asa ga kurumade",
      wordTexts: ["asa ga", "kurumade"],
      source: "generated",
    });
    const screen = await render(<RomanizationBanner />);
    await expect.element(screen.getByTestId("romanization-banner")).not.toBeInTheDocument();
  });

  it("is visible when metadata scheme is unset and at least one line is eligible", async () => {
    seedJapaneseLines();
    const screen = await render(<RomanizationBanner />);
    await expect.element(screen.getByTestId("romanization-banner")).toBeInTheDocument();
  });

  it("is visible when scheme is set but at least one eligible line lacks romanization", async () => {
    seedJapaneseLines();
    useProjectStore.getState().setMetadata({ romanizationScheme: "ja-Latn-hepburn" });
    useProjectStore.getState().setLineRomanizationWithHistory("L1", {
      text: "yoru dakedo",
      wordTexts: ["yoru", "dakedo"],
      source: "generated",
    });
    const screen = await render(<RomanizationBanner />);
    await expect.element(screen.getByTestId("romanization-banner")).toBeInTheDocument();
  });
});

// -- Scheme dropdown ----------------------------------------------------------

describe("RomanizationBanner scheme dropdown", () => {
  it("defaults to defaultSchemeForLang when metadata is unset", async () => {
    seedJapaneseLines();
    const screen = await render(<RomanizationBanner />);
    const select = screen.getByRole("combobox", { name: /scheme/i });
    await expect.element(select).toHaveValue("ja-Latn-hepburn");
  });

  it("initialises from metadata.romanizationScheme when set", async () => {
    seedJapaneseLines();
    useProjectStore.getState().setMetadata({ romanizationScheme: "ja-Latn-kunrei" });
    const screen = await render(<RomanizationBanner />);
    const select = screen.getByRole("combobox", { name: /scheme/i });
    await expect.element(select).toHaveValue("ja-Latn-kunrei");
  });
});

// -- Site key gate ------------------------------------------------------------

describe("RomanizationBanner site key gate", () => {
  it("disables Generate when the Turnstile site key is empty", async () => {
    useSettingsStore.setState({ romanizationTurnstileSiteKey: "" });
    const originalEnv = import.meta.env.VITE_TURNSTILE_SITEKEY;
    import.meta.env.VITE_TURNSTILE_SITEKEY = "";
    seedJapaneseLines();
    const screen = await render(<RomanizationBanner />);
    const button = screen.getByRole("button", { name: /generate/i });
    await expect.element(button).toBeDisabled();
    await expect.element(button).toHaveAttribute("title", expect.stringContaining("Turnstile"));
    import.meta.env.VITE_TURNSTILE_SITEKEY = originalEnv;
  });
});

// -- Generate flow ------------------------------------------------------------

describe("RomanizationBanner generate flow", () => {
  it("calls the API, applies results, and sets metadata.romanizationScheme on full success", async () => {
    seedJapaneseLines();
    fetchStub.mockResolvedValue(
      jsonResponse({
        results: [
          {
            id: "L1",
            lang: "ja",
            scheme: "ja-Latn-hepburn",
            text: "yoru dakedo",
            wordTexts: ["yoru", "dakedo"],
            engine: "cutlet",
            tier: 0,
          },
          {
            id: "L2",
            lang: "ja",
            scheme: "ja-Latn-hepburn",
            text: "asa ga kurumade",
            wordTexts: ["asa ga", "kurumade"],
            engine: "cutlet",
            tier: 0,
          },
        ],
        errors: [],
      }),
    );
    const screen = await render(<RomanizationBanner />);
    const button = screen.getByRole("button", { name: /generate/i });
    await button.click();

    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.text).toBe("yoru dakedo");
    expect(useProjectStore.getState().lines[1].romanization?.text).toBe("asa ga kurumade");
    expect(useProjectStore.getState().metadata.romanizationScheme).toBe("ja-Latn-hepburn");
    await expect.element(screen.getByTestId("romanization-banner")).not.toBeInTheDocument();
  });

  it("re-arms the banner after partial failure (some lines still missing romanization)", async () => {
    seedJapaneseLines();
    fetchStub.mockResolvedValue(
      jsonResponse({
        results: [
          {
            id: "L1",
            lang: "ja",
            scheme: "ja-Latn-hepburn",
            text: "yoru dakedo",
            wordTexts: ["yoru", "dakedo"],
            engine: "cutlet",
            tier: 0,
          },
        ],
        errors: [{ id: "L2", reason: "all-chain-tiers-exhausted" }],
      }),
    );
    const screen = await render(<RomanizationBanner />);
    const button = screen.getByRole("button", { name: /generate/i });
    await button.click();

    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.text).toBe("yoru dakedo");
    expect(useProjectStore.getState().lines[1].romanization).toBeUndefined();
    await expect.element(screen.getByTestId("romanization-banner")).toBeInTheDocument();
  });
});
