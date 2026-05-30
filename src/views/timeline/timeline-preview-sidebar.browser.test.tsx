import { describe, expect, it } from "vitest";
import { TimelinePreviewSidebar } from "@/views/timeline/timeline-preview-sidebar";
import { useProjectStore } from "@/stores/project";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";

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

  it("renders romaji above the source line when the scheme is set", async () => {
    useProjectStore.setState({
      metadata: { ...useProjectStore.getState().metadata, romanizationScheme: "ja-Latn-hepburn" },
      lines: [
        createLine({
          text: "夜だけど",
          words: [createWord({ text: "夜だけど", begin: 0, end: 1 })],
          romanization: { text: "yoru dakedo", source: "generated" },
        }),
      ],
    });
    const screen = await render(<TimelinePreviewSidebar />);
    await expect.element(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.container.textContent).toContain("yoru dakedo");
    const romaji = screen.container.querySelector('[data-testid="mini-preview-romaji"]');
    expect(romaji).not.toBeNull();
  });

  it("omits romaji when scheme is set but line has none", async () => {
    useProjectStore.setState({
      metadata: { ...useProjectStore.getState().metadata, romanizationScheme: "ja-Latn-hepburn" },
      lines: [
        createLine({
          text: "Hello world",
          words: [createWord({ text: "Hello", begin: 0, end: 1 })],
        }),
      ],
    });
    const screen = await render(<TimelinePreviewSidebar />);
    expect(screen.container.querySelector('[data-testid="mini-preview-romaji"]')).toBeNull();
  });

  it("omits romaji when scheme is unset even if the line has romanization", async () => {
    useProjectStore.setState({
      metadata: { ...useProjectStore.getState().metadata, romanizationScheme: undefined },
      lines: [
        createLine({
          text: "夜だけど",
          words: [createWord({ text: "夜だけど", begin: 0, end: 1 })],
          romanization: { text: "yoru dakedo", source: "generated" },
        }),
      ],
    });
    const screen = await render(<TimelinePreviewSidebar />);
    expect(screen.container.querySelector('[data-testid="mini-preview-romaji"]')).toBeNull();
  });
});
