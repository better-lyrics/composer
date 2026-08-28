import { useProjectStore } from "@/stores/project";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { TimelinePreviewSidebar } from "@/views/timeline/timeline-preview-sidebar";
import { describe, expect, it } from "vitest";

describe("TimelinePreviewSidebar", () => {
  it("shows the 'No synced content' fallback for an empty project", async () => {
    useProjectStore.setState({ lines: [] });
    const screen = await render(<TimelinePreviewSidebar />);
    await expect.element(screen.getByText("No synced content")).toBeInTheDocument();
  });

  it("renders the preview header and line text once any line has timing", async () => {
    useProjectStore.setState({
      lines: [createLine({ text: "hello world", words: [createWord({ text: "hello", begin: 0, end: 1 })] })],
    });
    const screen = await render(<TimelinePreviewSidebar />);
    await expect.element(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.container.textContent).toContain("hello");
  });

  it("shows main and background transliterations beneath the timed lyrics", async () => {
    useProjectStore.setState({
      lines: [
        createLine({
          text: "안녕",
          words: [createWord({ text: "안녕", begin: 0, end: 1 })],
          backgroundText: "세상",
          backgroundWords: [createWord({ text: "세상", begin: 0, end: 1 })],
        }),
      ],
    });
    useProjectStore.setState({
      lines: useProjectStore.getState().lines.map((line) => ({
        ...line,
        transliteration: {
          language: "ko-Latn",
          text: "annyeong",
          backgroundText: "sesang",
          segments: [{ original: "안녕", transliteration: "annyeong" }],
          origin: "manual",
          sourceFingerprint: "preview-test",
        },
      })),
    });

    const screen = await render(<TimelinePreviewSidebar />);

    expect(screen.container.querySelector('[data-preview-transliteration="main"] [data-word-begin]')?.textContent).toBe(
      "annyeong",
    );
    expect(
      screen.container.querySelector('[data-preview-transliteration="background"] [data-word-begin]')?.textContent,
    ).toBe("sesang");
  });

  it("uses canonical timed-word transliterations when line segments cannot be realigned", async () => {
    useProjectStore.setState({
      granularity: "word",
      lines: [
        {
          id: "canonical-words",
          agentId: "v1",
          text: "한국 노래",
          words: [
            { text: "한국 ", transliteration: "hanguk", begin: 0, end: 1 },
            { text: "노래", transliteration: "norae", begin: 1, end: 2 },
          ],
          transliteration: {
            language: "ko-Latn",
            text: "hanguknorae",
            segments: [{ original: "한국 노래", transliteration: "hanguknorae" }],
            origin: "import",
            sourceFingerprint: "test",
          },
        },
      ],
    });

    const screen = await render(<TimelinePreviewSidebar />);
    const romanizedWords = Array.from(
      screen.container.querySelectorAll('[data-preview-transliteration="main"] [data-word-begin]'),
      (word) => word.textContent,
    );

    expect(romanizedWords).toEqual(["hanguk ", "norae"]);
  });
});
