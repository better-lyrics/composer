import { render } from "@/test/render";
import { LibraryFooter } from "@/views/library/library-footer";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

describe("LibraryFooter", () => {
  it("shows the stored audio size and opens storage settings", async () => {
    let opened = 0;
    const screen = await render(<LibraryFooter storedAudioBytes={343_700_000} onManageStorage={() => opened++} />);
    await expect.element(screen.getByText("327.8 MB")).toBeInTheDocument();
    expect(screen.container.textContent).toContain("Projects save on this device.");
    expect(screen.container.textContent).toContain("of audio stored.");
    await screen.getByRole("button", { name: "Manage storage" }).click();
    expect(opened).toBe(1);
  });

  it("opens storage settings from the keyboard", async () => {
    let opened = 0;
    await render(<LibraryFooter storedAudioBytes={0} onManageStorage={() => opened++} />);
    await userEvent.keyboard("{Tab}{Enter}");
    expect(opened).toBe(1);
  });

  describe("edge cases", () => {
    it("reads naturally with no audio stored", async () => {
      const screen = await render(<LibraryFooter storedAudioBytes={0} onManageStorage={() => {}} />);
      await expect.element(screen.getByText("0 B")).toBeInTheDocument();
    });
  });
});
