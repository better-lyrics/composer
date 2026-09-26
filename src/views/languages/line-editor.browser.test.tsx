import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import { useProjectStore } from "@/stores/project";
import { LanguageLineEditor } from "@/views/languages/line-editor";
import { beforeEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

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
