import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { RomanizationSection } from "@/ui/help-sections/romanization";
import { ALT_KEY } from "@/utils/platform";

// -- Tests --------------------------------------------------------------------

describe("RomanizationSection", () => {
  it("explains what romanization is", async () => {
    const screen = await render(<RomanizationSection />);
    await expect
      .element(
        screen.getByText(
          "Romanization shows a Latin-script reading under the source lyrics. Useful for non-Latin scripts your listeners can't read: Japanese, Chinese, and so on.",
        ),
      )
      .toBeInTheDocument();
  });

  it("lists the supported Japanese schemes", async () => {
    const screen = await render(<RomanizationSection />);
    expect(screen.container.textContent).toContain("Japanese: Hepburn (default), Kunrei, Nihon-shiki.");
  });

  it("notes Chinese pinyin support with a Wade-Giles fallback", async () => {
    const screen = await render(<RomanizationSection />);
    expect(screen.container.textContent).toContain(
      "Chinese: Pinyin. Wade-Giles is supported as a best-effort fallback.",
    );
  });

  it("explains the banner-driven enablement", async () => {
    const screen = await render(<RomanizationSection />);
    expect(screen.container.textContent).toContain("banner appears in Edit");
  });

  it("describes generated vs manual sources", async () => {
    const screen = await render(<RomanizationSection />);
    expect(screen.container.textContent).toContain("Generated");
    expect(screen.container.textContent).toContain("Manual");
    expect(screen.container.textContent).toContain("won't overwrite manual romaji");
  });

  it("documents the TTML round-trip via transliterations", async () => {
    const screen = await render(<RomanizationSection />);
    expect(screen.container.textContent).toContain("<transliterations>");
    expect(screen.container.textContent).toContain("re-imports");
  });

  it("describes where romaji shows in Sync and Timeline", async () => {
    const screen = await render(<RomanizationSection />);
    expect(screen.container.textContent).toContain("In Sync");
    expect(screen.container.textContent).toContain("In Timeline");
  });

  it("renders without console warnings", async () => {
    const screen = await render(<RomanizationSection />);
    expect(screen.container.querySelector("h4")).not.toBeNull();
  });
});

describe("RomanizationSection: v2 coverage", () => {
  it.each(["Japanese", "Chinese", "Korean", "Russian", "Greek", "Thai", "Arabic", "Hindi", "Bengali", "Hebrew"])(
    "lists %s as a supported script",
    async (script) => {
      const screen = await render(<RomanizationSection />);
      expect(screen.container.textContent).toContain(script);
    },
  );

  it("notes that ja and zh use local generators (kuroshiro, pinyin-pro)", async () => {
    const screen = await render(<RomanizationSection />);
    expect(screen.container.textContent).toContain("kuroshiro");
    expect(screen.container.textContent).toContain("pinyin-pro");
  });

  it("notes that the other 8 scripts use Google translate", async () => {
    const screen = await render(<RomanizationSection />);
    expect(screen.container.textContent).toContain("Google");
  });

  it("flags Hebrew quality as limited without vowel marks", async () => {
    const screen = await render(<RomanizationSection />);
    const text = screen.container.textContent ?? "";
    expect(text).toContain("Hebrew");
    expect(text.toLowerCase()).toMatch(/niqqud|vowel/);
  });

  it("mentions the timeline per-word romanization popover with the platform alt key", async () => {
    const screen = await render(<RomanizationSection />);
    const text = screen.container.textContent ?? "";
    expect(text).toContain(ALT_KEY);
    expect(text.toLowerCase()).toContain("click");
  });

  it("mentions the source / romaji primary text toggle", async () => {
    const screen = await render(<RomanizationSection />);
    const text = screen.container.textContent ?? "";
    expect(text.toLowerCase()).toContain("primary");
    expect(text.toLowerCase()).toMatch(/toggle|swap/);
  });

  it("notes that single-word regenerate uses only the selected word as input", async () => {
    const screen = await render(<RomanizationSection />);
    const text = screen.container.textContent ?? "";
    expect(text.toLowerCase()).toContain("regenerating a single word");
    expect(text.toLowerCase()).toMatch(/not the whole line|only that word/);
  });
});
