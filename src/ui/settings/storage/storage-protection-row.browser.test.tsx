import { render } from "@/test/render";
import { StorageProtectionRow } from "@/ui/settings/storage/storage-protection-row";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Constants ----------------------------------------------------------------

const UNPROTECTED = "The browser can clear your projects, lyrics included, when disk space runs low.";

// -- Tests --------------------------------------------------------------------

describe("StorageProtectionRow", () => {
  it("labels the row from the settings catalog", async () => {
    const screen = await render(<StorageProtectionRow status="protected" browser="other" onProtect={() => {}} />);
    await expect.element(screen.getByText("Storage protection")).toBeInTheDocument();
  });

  it("confirms protected storage with an On chip and no button", async () => {
    const screen = await render(<StorageProtectionRow status="protected" browser="chromium" onProtect={() => {}} />);
    await expect.element(screen.getByText("On", { exact: true })).toBeInTheDocument();
    await expect
      .element(screen.getByText("The browser won't clear your projects when disk space runs low."))
      .toBeInTheDocument();
    expect(screen.getByRole("button").elements()).toHaveLength(0);
  });

  it("warns about unprotected storage and asks again", async () => {
    let asked = 0;
    const screen = await render(
      <StorageProtectionRow status="unprotected" browser="other" onProtect={() => asked++} />,
    );
    await expect.element(screen.getByText("Off", { exact: true })).toBeInTheDocument();
    await expect.element(screen.getByText(UNPROTECTED)).toBeInTheDocument();
    await screen.getByRole("button", { name: "Protect storage" }).click();
    expect(asked).toBe(1);
  });

  it("asks again from the keyboard", async () => {
    let asked = 0;
    await render(<StorageProtectionRow status="unprotected" browser="other" onProtect={() => asked++} />);
    await userEvent.keyboard("{Tab}{Enter}");
    expect(asked).toBe(1);
  });

  describe("Chromium browsers", () => {
    it("names the menu item to install the app, with the other ways in the same sentence", async () => {
      const screen = await render(
        <StorageProtectionRow status="unprotected" browser="chromium" onProtect={() => {}} />,
      );
      await expect.element(screen.getByText("Install page as app", { exact: true })).toBeInTheDocument();
      const description = screen.getByText("Install page as app", { exact: true }).element().parentElement;
      expect(description?.textContent).toBe(
        `${UNPROTECTED} To turn it on, use Install page as app in the browser menu or bookmark Composer, then ask again. This doesn't work in Incognito.`,
      );
      expect(screen.getByText(UNPROTECTED, { exact: true }).elements()).toHaveLength(0);
    });

    it("still asks again when clicked", async () => {
      let asked = 0;
      const screen = await render(
        <StorageProtectionRow status="unprotected" browser="chromium" onProtect={() => asked++} />,
      );
      await screen.getByRole("button", { name: "Protect storage" }).click();
      expect(asked).toBe(1);
    });
  });

  describe("asking", () => {
    it("disables Protect storage while the browser is being asked", async () => {
      let asked = 0;
      const screen = await render(
        <StorageProtectionRow status="unprotected" browser="other" isProtecting onProtect={() => asked++} />,
      );
      await expect.element(screen.getByRole("button", { name: "Protect storage" })).toBeDisabled();
      await userEvent.keyboard("{Tab}{Enter}");
      expect(asked).toBe(0);
    });

    it("announces the status and moves focus to it once protection is on", async () => {
      const screen = await render(<StorageProtectionRow status="unprotected" browser="other" onProtect={() => {}} />);
      await screen.getByRole("button", { name: "Protect storage" }).click();
      await screen.rerender(
        <StorageProtectionRow status="unprotected" browser="other" isProtecting onProtect={() => {}} />,
      );
      await screen.rerender(<StorageProtectionRow status="protected" browser="other" onProtect={() => {}} />);
      const status = screen.getByRole("status");
      await expect.element(status).toHaveTextContent("On");
      await expect.element(status).toHaveFocus();
    });

    it("keeps focus on the button when the browser declines", async () => {
      const screen = await render(<StorageProtectionRow status="unprotected" browser="other" onProtect={() => {}} />);
      await screen.getByRole("button", { name: "Protect storage" }).click();
      await screen.rerender(
        <StorageProtectionRow status="unprotected" browser="other" isProtecting onProtect={() => {}} />,
      );
      await screen.rerender(<StorageProtectionRow status="unprotected" browser="other" onProtect={() => {}} />);
      await expect.element(screen.getByRole("button", { name: "Protect storage" })).toHaveFocus();
    });

    it("leaves focus alone when the status changes without a request from this row", async () => {
      const screen = await render(<StorageProtectionRow status="unprotected" browser="other" onProtect={() => {}} />);
      await screen.rerender(<StorageProtectionRow status="protected" browser="other" onProtect={() => {}} />);
      await expect.element(screen.getByRole("status")).not.toHaveFocus();
    });
  });

  describe("edge cases", () => {
    it("says protection is unavailable, without a button, and points to the backup", async () => {
      const screen = await render(
        <StorageProtectionRow status="unsupported" browser="chromium" onProtect={() => {}} />,
      );
      await expect.element(screen.getByText("Unavailable", { exact: true })).toBeInTheDocument();
      await expect.element(screen.getByText(/This browser can't protect storage/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Protect storage" }).elements()).toHaveLength(0);
      expect(screen.getByText("Install page as app", { exact: true }).elements()).toHaveLength(0);
    });

    it("shows nothing until the status is known", async () => {
      const screen = await render(<StorageProtectionRow status={undefined} browser="other" onProtect={() => {}} />);
      expect(screen.container.textContent).toBe("");
    });
  });
});
