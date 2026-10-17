import { describe, expect, it } from "vitest";
import { ScrollableLine } from "@/views/sync/scrollable-line";
import { render } from "@/test/render";

const BASE_PROPS = {
  lineId: "test-line",
  text: "Hello world",
  lineNumber: 0,
  isCurrent: false,
  granularity: "word" as const,
  currentTime: 0,
  editMode: false,
  onClick: () => {},
};

describe("ScrollableLine", () => {
  it("renders the line text", async () => {
    const screen = await render(<ScrollableLine {...BASE_PROPS} />);
    expect(screen.container.textContent).toContain("Hello");
    expect(screen.container.textContent).toContain("world");
  });

  it("invokes onClick when the line is clicked", async () => {
    let clicks = 0;
    const screen = await render(<ScrollableLine {...BASE_PROPS} onClick={() => clicks++} />);
    (screen.container.querySelector("div") as HTMLElement).click();
    expect(clicks).toBeGreaterThan(0);
  });

  it("shows background text alongside the main line when provided", async () => {
    const screen = await render(<ScrollableLine {...BASE_PROPS} backgroundText="(echo)" />);
    expect(screen.container.textContent).toContain("(echo)");
  });

  it("renders only the line-number gutter when text is empty", async () => {
    const screen = await render(<ScrollableLine {...BASE_PROPS} text="" />);
    expect((screen.container.textContent ?? "").trim()).toBe(String(BASE_PROPS.lineNumber));
  });

  it("clicking a word fires onClickWord with its index and does not bubble to the line onClick", async () => {
    let lineClicks = 0;
    let clickedWord = -1;
    const screen = await render(
      <ScrollableLine
        {...BASE_PROPS}
        words={[
          { text: "Hello ", begin: 0, end: 0.5 },
          { text: "world", begin: 0.5, end: 1 },
        ]}
        onClick={() => {
          lineClicks++;
        }}
        onClickWord={(idx) => {
          clickedWord = idx;
        }}
      />,
    );
    await screen.getByRole("button", { name: "world", exact: true }).click();
    expect(clickedWord).toBe(1);
    expect(lineClicks).toBe(0);
  });
});

describe("ScrollableLine link chip", () => {
  const linkInfo = { color: "#ff0000", label: "Chorus", ordinal: 2, totalInstances: 3 };

  it("shows the instance ordinal", async () => {
    const screen = await render(<ScrollableLine {...BASE_PROPS} linkInfo={linkInfo} />);
    await expect.element(screen.getByText("2/3")).toBeInTheDocument();
  });

  it("shows Shared in place of the ordinal on a skipped line", async () => {
    const screen = await render(<ScrollableLine {...BASE_PROPS} linkInfo={{ ...linkInfo, shared: true }} />);
    await expect.element(screen.getByText("Shared")).toBeInTheDocument();
    expect(screen.container.textContent).not.toContain("2/3");
  });

  describe("regressions", () => {
    it("regression: re-renders when only the shared flag changes", async () => {
      const screen = await render(<ScrollableLine {...BASE_PROPS} linkInfo={linkInfo} />);
      await screen.rerender(<ScrollableLine {...BASE_PROPS} linkInfo={{ ...linkInfo, shared: true }} />);
      await expect.element(screen.getByText("Shared")).toBeInTheDocument();
    });
  });
});
