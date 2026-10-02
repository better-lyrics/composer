import { indexEntry } from "@/test/index-entries";
import { render } from "@/test/render";
import { ResumeCard } from "@/views/library/resume-card";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Constants ----------------------------------------------------------------

const NOW = new Date(2026, 8, 27, 12, 0, 0).getTime();
const MINUTE = 60_000;

const MIDNIGHT_CITY = indexEntry("p01", {
  title: "Midnight City",
  artists: ["M83"],
  lineCount: 38,
  syncedLineCount: 23,
  hasWordTiming: true,
  updatedAt: NOW - 12 * MINUTE,
  lastTab: "sync",
});

// -- Tests --------------------------------------------------------------------

describe("ResumeCard", () => {
  it("shows the project, when it was edited and how far it is synced", async () => {
    const screen = await render(<ResumeCard project={MIDNIGHT_CITY} now={NOW} onOpen={() => {}} />);
    await expect.element(screen.getByRole("region", { name: "Midnight City" })).toBeInTheDocument();
    await expect.element(screen.getByText("Edited 12 min ago")).toBeInTheDocument();
    await expect.element(screen.getByText("M83")).toBeInTheDocument();
    await expect.element(screen.getByText("23 of 38 lines synced, word by word")).toBeInTheDocument();
    await expect.element(screen.getByText("61%")).toBeInTheDocument();
    await expect
      .element(screen.getByRole("progressbar", { name: "23 of 38 lines synced, word by word" }))
      .toBeInTheDocument();
  });

  it("names the action after the tab the project was left on", async () => {
    const screen = await render(<ResumeCard project={MIDNIGHT_CITY} now={NOW} onOpen={() => {}} />);
    await expect.element(screen.getByRole("button", { name: "Continue syncing" })).toBeInTheDocument();
  });

  it("opens the project from the keyboard", async () => {
    const opened: string[] = [];
    const screen = await render(<ResumeCard project={MIDNIGHT_CITY} now={NOW} onOpen={(id) => opened.push(id)} />);
    screen.getByRole("button", { name: "Continue syncing" }).element().focus();
    await userEvent.keyboard("{Enter}");
    expect(opened).toEqual(["p01"]);
  });

  it("opens the project on click", async () => {
    const opened: string[] = [];
    const screen = await render(<ResumeCard project={MIDNIGHT_CITY} now={NOW} onOpen={(id) => opened.push(id)} />);
    await screen.getByRole("button", { name: "Continue syncing" }).click();
    expect(opened).toEqual(["p01"]);
  });

  describe("edge cases", () => {
    it("says there are no lyrics yet and shows no bar", async () => {
      const screen = await render(
        <ResumeCard project={indexEntry("p08", { title: "Untitled demo 3" })} now={NOW} onOpen={() => {}} />,
      );
      await expect.element(screen.getByText("No lyrics yet")).toBeInTheDocument();
      expect(screen.container.querySelector("[role='progressbar']")).toBeNull();
    });

    it("falls back for a missing title, artist and last tab", async () => {
      const screen = await render(<ResumeCard project={indexEntry("x", { title: "" })} now={NOW} onOpen={() => {}} />);
      await expect.element(screen.getByRole("region", { name: "Untitled" })).toBeInTheDocument();
      await expect.element(screen.getByText("No artist")).toBeInTheDocument();
      await expect.element(screen.getByRole("button", { name: "Open project" })).toBeInTheDocument();
    });

    it("has a label for every tab, including Languages", async () => {
      const screen = await render(
        <ResumeCard project={indexEntry("x", { lastTab: "languages" })} now={NOW} onOpen={() => {}} />,
      );
      await expect.element(screen.getByRole("button", { name: "Continue in Languages" })).toBeInTheDocument();
    });

    it("keeps the date after a week", async () => {
      const screen = await render(
        <ResumeCard
          project={indexEntry("x", { updatedAt: new Date(2026, 8, 1).getTime() })}
          now={NOW}
          onOpen={() => {}}
        />,
      );
      await expect.element(screen.getByText("Edited Sep 1")).toBeInTheDocument();
    });
  });
});
