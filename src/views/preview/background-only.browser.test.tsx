import type { LyricLine } from "@/domain/line/model";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { allowConsole } from "@/test/console-guard";
import { render } from "@/test/render";
import { generateTTML } from "@/utils/ttml";
import { AmLyricsRenderer } from "@/views/preview/am-lyrics-renderer";
import { BraccatoRenderer } from "@/views/preview/braccato-renderer";
import { describe, expect, it } from "vitest";

function backgroundOnlyTtml(timedBackground: boolean): string {
  const line: LyricLine = {
    id: "background-only",
    text: "Hello world",
    agentId: "v1",
    words: [
      { text: "Hello ", begin: 1, end: 2 },
      { text: "world", begin: 2, end: 3 },
    ],
    backgroundText: "空",
    ...(timedBackground ? { backgroundWords: [{ text: "空", begin: 2, end: 3 }] } : {}),
    transliteration: {
      language: "ja-Latn",
      text: "",
      backgroundText: "sora",
      segments: [],
      origin: "manual",
      sourceFingerprint: "fixture",
    },
    translations: {
      en: { language: "en", text: "", backgroundText: "Sky", origin: "manual", sourceFingerprint: "fixture" },
    },
  };
  const { metadata, agents } = useProjectStore.getState();
  return generateTTML({ metadata, agents, lines: [line], granularity: "word", duration: 5 });
}

describe("background-only alternate previews", () => {
  for (const timedBackground of [true, false]) {
    it(`shows background-only alternates in Braccato with ${timedBackground ? "word" : "line"} background timing`, async () => {
      useAudioStore.setState({ audioElement: new Audio() });
      const screen = await render(<BraccatoRenderer ttmlString={backgroundOnlyTtml(timedBackground)} />);

      await expect.poll(() => screen.container.querySelector(".blyrics--romanized")?.textContent).toContain("sora");
      await expect.poll(() => screen.container.querySelector(".blyrics--translated")?.textContent).toContain("Sky");
    });

    it(`shows background-only alternates in am-lyrics with ${timedBackground ? "word" : "line"} background timing`, async () => {
      allowConsole(/dev mode/i);
      useAudioStore.setState({ audioElement: new Audio() });
      const screen = await render(
        <AmLyricsRenderer ttmlString={backgroundOnlyTtml(timedBackground)} durationSeconds={5} />,
      );
      const alternateText = (selector: string) =>
        [...(screen.container.querySelector("am-lyrics")?.shadowRoot?.querySelectorAll(selector) ?? [])]
          .map((element) => element.textContent ?? "")
          .join(" ");

      await expect
        .poll(() => alternateText(".lyrics-romanization-container, .lyrics-syllable.transliteration"))
        .toContain("sora");
      await expect.poll(() => alternateText(".lyrics-translation-container")).toContain("Sky");
    });
  }
});
