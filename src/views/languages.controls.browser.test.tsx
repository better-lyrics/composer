import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import { useProjectStore } from "@/stores/project";
import { stubJapaneseGoogleLanguageFetch } from "@/test/google-language-fetch";
import { LanguagesPanel } from "@/views/languages";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";

// -- Tests --------------------------------------------------------------------

describe("LanguagesPanel header controls", () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
    useProjectStore.getState().setLines([{ id: "l1", text: "こんにちは", agentId: "v1" }]);
    useProjectStore.getState().setActiveTab("languages");
    stubJapaneseGoogleLanguageFetch();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("lets the user override the detected source language", async () => {
    const screen = await render(<LanguagesPanel />);
    const source = screen.getByRole("button", { name: "Source language" });
    await expect.element(source).toHaveTextContent("Japanese");
    await source.click();
    await screen.getByRole("option", { name: "Korean" }).click();
    await expect.poll(() => useProjectStore.getState().metadata.language).toBe("ko");
  });

  it("regression: disables the source picker while generation is running", async () => {
    useProjectStore.getState().setLines([{ id: "regression-source-disable", text: "未使用の歌詞", agentId: "v1" }]);
    const pending: Array<() => void> = [];
    vi.stubGlobal(
      "fetch",
      () =>
        new Promise<Response>((resolve) => {
          pending.push(() => resolve(new Response(JSON.stringify([[["x", "y"]], null, "ja"]), { status: 200 })));
        }),
    );
    const screen = await render(<LanguagesPanel />);
    await expect.element(screen.getByRole("button", { name: "Source language" })).toBeDisabled();
    await expect.poll(() => pending.length).toBeGreaterThan(0);
    for (const resolve of pending.splice(0)) resolve();
    await expect.element(screen.getByRole("button", { name: "Source language" })).toBeEnabled();
  });

  it("selectively regenerates transliteration or individual translations", async () => {
    const text = "選択再生成";
    const fingerprint = languageSourceFingerprint(text);
    useProjectStore.getState().setMetadata({ language: "ja" });
    useProjectStore.getState().setLines([
      {
        id: "selective-regeneration",
        text,
        agentId: "v1",
        transliteration: {
          language: "ja-Latn",
          text: "Edited reading",
          segments: [{ original: text, transliteration: "Edited reading" }],
          origin: "manual",
          sourceFingerprint: fingerprint,
        },
        translations: {
          en: {
            language: "en",
            text: "Edited English",
            origin: "manual",
            sourceFingerprint: fingerprint,
          },
          es: {
            language: "es",
            text: "Edited Spanish",
            origin: "manual",
            sourceFingerprint: fingerprint,
          },
        },
      },
    ]);
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      const romanization = url.searchParams.getAll("dt").includes("rm");
      const target = url.searchParams.get("tl");
      const generated = romanization ? "sentaku-saisei" : target === "es" ? "Español generado" : "Generated English";
      const data = romanization
        ? [
            [
              [text, text, null, null],
              [null, null, generated, generated],
            ],
            null,
            "ja",
          ]
        : [[[generated, text]], null, "ja"];
      return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
    });

    const screen = await render(<LanguagesPanel />);
    await expect.element(screen.getByRole("textbox", { name: "Spanish" })).toHaveValue("Edited Spanish");

    await screen.getByRole("button", { name: "Choose what to regenerate" }).click();
    await screen.getByRole("checkbox", { name: "Transliteration" }).click();
    await screen.getByRole("checkbox", { name: "English" }).click();
    await screen.getByRole("button", { name: "Regenerate 1 track" }).click();

    await expect.element(screen.getByRole("textbox", { name: "Spanish" })).toHaveValue("Español generado");
    await expect.element(screen.getByRole("textbox", { name: "English" })).toHaveValue("Edited English");
    await expect.element(screen.getByRole("textbox", { name: "Transliteration" })).toHaveValue("Edited reading");
  });

  it("preselects the translation language from the field receiving a multiline paste", async () => {
    useProjectStore
      .getState()
      .setLines(["하나", "둘", "셋", "넷"].map((text, index) => ({ id: `l${index}`, text, agentId: "v1" })));
    const screen = await render(<LanguagesPanel />);
    await expect.element(screen.getByRole("textbox", { name: "English" }).first()).toBeInTheDocument();
    const englishField = screen.container.querySelector<HTMLInputElement>('input[data-language-import-language="en"]');
    expect(englishField).not.toBeNull();
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", "One\nTwo\nThree\nFour");
    englishField!.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, clipboardData }));

    await expect.element(screen.getByRole("dialog", { name: "Import pasted lines" })).toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: "Imported translation language" }))
      .toHaveTextContent("English");
    await expect.element(screen.getByRole("button", { name: "Import 4 lines" })).toBeInTheDocument();
  });
});
