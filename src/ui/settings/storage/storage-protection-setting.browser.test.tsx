import { render } from "@/test/render";
import { StorageProtectionSetting } from "@/ui/settings/storage/storage-protection-setting";
import { Toaster } from "sonner";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

const DECLINED = "Your browser said no for now. Try one of the steps, then ask again.";

function spyOnPersist() {
  return vi.spyOn(navigator.storage, "persist").mockClear();
}

async function browserStatus(): Promise<"protected" | "unprotected"> {
  return (await navigator.storage.persisted()) ? "protected" : "unprotected";
}

async function assertProtectedNoticeShown(screen: Awaited<ReturnType<typeof render>>): Promise<void> {
  await expect.element(screen.getByText("On", { exact: true })).toBeInTheDocument();
  expect(screen.getByRole("button").elements()).toHaveLength(0);
}

async function assertUnprotectedNoticeShown(screen: Awaited<ReturnType<typeof render>>): Promise<void> {
  await expect.element(screen.getByText("Off", { exact: true })).toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: "Protect storage" })).toBeInTheDocument();
}

// -- Tests --------------------------------------------------------------------

describe("StorageProtectionSetting", () => {
  it("shows the browser's real protection status", async () => {
    const screen = await render(<StorageProtectionSetting />);
    if ((await browserStatus()) === "protected") await assertProtectedNoticeShown(screen);
    else await assertUnprotectedNoticeShown(screen);
  });

  it("asks the browser to protect storage when the button is clicked", async () => {
    const persist = spyOnPersist();
    const screen = await render(<StorageProtectionSetting />);
    if ((await browserStatus()) === "protected") {
      await assertProtectedNoticeShown(screen);
      expect(persist).not.toHaveBeenCalled();
    } else {
      await assertUnprotectedNoticeShown(screen);
      await screen.getByRole("button", { name: "Protect storage" }).click();
      await expect.poll(() => persist.mock.calls.length).toBe(1);
    }
  });

  it("asks the browser to protect storage from the keyboard", async () => {
    const persist = spyOnPersist();
    const screen = await render(<StorageProtectionSetting />);
    if ((await browserStatus()) === "protected") {
      await assertProtectedNoticeShown(screen);
      expect(persist).not.toHaveBeenCalled();
    } else {
      const button = screen.getByRole("button", { name: "Protect storage" });
      await expect.element(button).toBeInTheDocument();
      (button.element() as HTMLElement).focus();
      await userEvent.keyboard("{Enter}");
      await expect.poll(() => persist.mock.calls.length).toBe(1);
    }
  });

  describe("edge cases", () => {
    it("tells the user the real outcome after asking for protection", async () => {
      const persist = spyOnPersist();
      const screen = await render(
        <>
          <Toaster />
          <StorageProtectionSetting />
        </>,
      );
      if ((await browserStatus()) === "protected") {
        await assertProtectedNoticeShown(screen);
        expect(screen.getByText(DECLINED).elements()).toHaveLength(0);
        return;
      }
      await assertUnprotectedNoticeShown(screen);
      await screen.getByRole("button", { name: "Protect storage" }).click();
      await expect.poll(() => persist.mock.results.length).toBe(1);
      if (await persist.mock.results[0]?.value) {
        await expect.element(screen.getByText("On", { exact: true })).toBeInTheDocument();
        expect(screen.getByText(DECLINED).elements()).toHaveLength(0);
      } else {
        await expect.element(screen.getByText(DECLINED)).toBeInTheDocument();
        await assertUnprotectedNoticeShown(screen);
      }
    });
  });
});
