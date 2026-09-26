import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import { useProjectStore } from "@/stores/project";
import { LanguageLineEditor } from "@/views/languages/line-editor";
import { beforeEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

describe("regressions", () => {
  it("regression: marks a changed translation on its field and row without an accent border", async () => {
    const line = {
      id: "row",
      text: "너를 비춰줄게",
      agentId: "v1",
      translations: {
        en: { language: "en", text: "I will light you up", origin: "manual" as const, sourceFingerprint: "old" },
      },
    };
    useProjectStore.getState().setLines([line]);
    const screen = await render(
      <LanguageLineEditor line={line} index={1} targets={["en"]} languageNames={new Map([["en", "English"]])} />,
    );
    await expect.element(screen.getByText("Needs review", { exact: true })).toBeInTheDocument();
    const row = screen.container.querySelector("section");
    expect(row?.className).toContain("bg-composer-warning/[0.04]");
    expect(row?.className).not.toMatch(/inset_2px|border-l-/);
    await expect.element(screen.getByRole("textbox", { name: "English" })).toHaveClass("border-composer-warning/40");
  });
});

describe("edge cases", () => {
  it("renders only the transliteration field when there are no translation targets", async () => {
    const line = { id: "row", text: "Hello", agentId: "v1" };
    useProjectStore.getState().setLines([line]);
    const screen = await render(<LanguageLineEditor line={line} index={0} targets={[]} languageNames={new Map()} />);
    await expect.element(screen.getByRole("textbox", { name: "Transliteration" })).toBeInTheDocument();
    expect(screen.container.querySelectorAll("input").length).toBe(1);
  });

  it("renders no background section when the line has no background text", async () => {
    const line = { id: "row", text: "Hello", agentId: "v1" };
    useProjectStore.getState().setLines([line]);
    const screen = await render(
      <LanguageLineEditor line={line} index={0} targets={["en"]} languageNames={new Map([["en", "English"]])} />,
    );
    expect(screen.container.querySelector("p")).toBeNull();
  });

  it("shows a timing mismatch chip and error tint when transliteration alignment fails", async () => {
    const sourceFingerprint = languageSourceFingerprint("가|나");
    const line = {
      id: "row",
      text: "가|나",
      agentId: "v1",
      words: [
        { text: "가", begin: 0, end: 0.5, syllableGroupId: "group" },
        { text: "나", begin: 0.5, end: 1, syllableGroupId: "group" },
      ],
      transliteration: {
        language: "ko-Latn",
        text: "g",
        segments: [],
        origin: "manual" as const,
        sourceFingerprint,
      },
    };
    useProjectStore.getState().setLines([line]);
    const screen = await render(<LanguageLineEditor line={line} index={0} targets={[]} languageNames={new Map()} />);
    await expect.element(screen.getByText("Timing mismatch", { exact: true })).toBeInTheDocument();
    const row = screen.container.querySelector("section");
    expect(row?.className).toContain("bg-composer-error/[0.08]");
  });
});

function Editor() {
  const line = useProjectStore((state) => state.lines[0]);
  if (!line) return null;
  return (
    <LanguageLineEditor
      line={line}
      index={0}
      targets={["en"]}
      languageNames={new Map([["en", "English"]])}
      sourceLanguage="ja"
    />
  );
}

describe("background alternate editing", () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
    useProjectStore.getState().setLines([
      {
        id: "background-only",
        text: "Hello",
        agentId: "v1",
        words: [{ text: "Hello", begin: 1, end: 2 }],
        backgroundText: "空",
        backgroundWords: [{ text: "空", begin: 1, end: 2 }],
        backgroundTextSource: "manual",
      },
    ]);
  });

  it("creates and clears background-only transliteration and translation tracks", async () => {
    const screen = await render(<Editor />);
    await screen.getByRole("textbox", { name: "Background transliteration", exact: true }).fill("sora");
    await screen.getByRole("textbox", { name: "Background English", exact: true }).fill("Sky");
    expect(useProjectStore.getState().lines[0].transliteration).toMatchObject({ text: "", backgroundText: "sora" });
    expect(useProjectStore.getState().lines[0].translations?.en).toMatchObject({ text: "", backgroundText: "Sky" });
    expect(useProjectStore.getState().lines[0].backgroundWords?.[0].transliteration).toBe("sora");

    await screen.getByRole("textbox", { name: "Background transliteration", exact: true }).fill("");
    await screen.getByRole("textbox", { name: "Background English", exact: true }).fill("");
    expect(useProjectStore.getState().lines[0].transliteration).toBeUndefined();
    expect(useProjectStore.getState().lines[0].translations?.en).toBeUndefined();
    expect(useProjectStore.getState().lines[0].backgroundWords?.[0].transliteration).toBeUndefined();
  });

  it("preserves background text and timing when foreground alternates are cleared", async () => {
    const sourceFingerprint = languageSourceFingerprint("Hello", "空");
    useProjectStore.getState().updateLine("background-only", {
      words: [{ text: "Hello", begin: 1, end: 2, transliteration: "hello" }],
      backgroundWords: [{ text: "空", begin: 1, end: 2, transliteration: "sora" }],
      transliteration: {
        language: "ja-Latn",
        text: "hello",
        backgroundText: "sora",
        segments: [],
        origin: "manual",
        sourceFingerprint,
      },
      translations: {
        en: { language: "en", text: "Hello", backgroundText: "Sky", origin: "manual", sourceFingerprint },
      },
    });
    const screen = await render(<Editor />);
    await screen.getByRole("textbox", { name: "Transliteration", exact: true }).fill("");
    await screen.getByRole("textbox", { name: "English", exact: true }).fill("");
    expect(useProjectStore.getState().lines[0].transliteration).toMatchObject({ text: "", backgroundText: "sora" });
    expect(useProjectStore.getState().lines[0].translations?.en).toMatchObject({ text: "", backgroundText: "Sky" });
    expect(useProjectStore.getState().lines[0].words?.[0].transliteration).toBeUndefined();
    expect(useProjectStore.getState().lines[0].backgroundWords?.[0]).toMatchObject({
      begin: 1,
      end: 2,
      transliteration: "sora",
    });
  });
});
