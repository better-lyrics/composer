import { useStorageProtection } from "@/hooks/useStorageProtection";
import { render } from "@/test/render";
import type { BrowserKind } from "@/utils/platform";
import { Toaster } from "sonner";
import { describe, expect, it, vi } from "vitest";

// -- Helpers ------------------------------------------------------------------

const CHROMIUM_DECLINED = "Your browser said no for now. Try one of the steps, then ask again.";
const OTHER_DECLINED = "Your browser didn't allow it this time.";

function spyOnPersist() {
  return vi.spyOn(navigator.storage, "persist").mockClear();
}

let latest: ReturnType<typeof useStorageProtection>;

const ProtectionProbe: React.FC<{ browser?: BrowserKind }> = ({ browser }) => {
  latest = useStorageProtection(browser);
  return <Toaster />;
};

async function browserStatus(): Promise<string> {
  return (await navigator.storage.persisted()) ? "protected" : "unprotected";
}

// -- Tests --------------------------------------------------------------------

describe("useStorageProtection", () => {
  it("reports the browser's protection status", async () => {
    await render(<ProtectionProbe />);
    await expect.poll(() => latest?.status).toBe(await browserStatus());
  });

  it("asking again asks the browser and shows exactly its answer", async () => {
    const persist = spyOnPersist();
    await render(<ProtectionProbe />);
    await expect.poll(() => latest?.status).toBeDefined();
    await latest.protect();
    expect(persist).toHaveBeenCalledTimes(1);
    const granted = await persist.mock.results[0]?.value;
    await expect.poll(() => latest.status).toBe(granted ? "protected" : "unprotected");
  });

  it("asks the browser once when protection is requested twice in a row", async () => {
    const persist = spyOnPersist();
    await render(<ProtectionProbe />);
    await expect.poll(() => latest?.status).toBeDefined();
    const first = latest.protect();
    const second = latest.protect();
    await Promise.all([first, second]);
    expect(persist).toHaveBeenCalledTimes(1);
    await expect.poll(() => latest.isProtecting).toBe(false);
  });

  describe("edge cases", () => {
    it("tells a Chromium user when the browser declines, and says nothing when it grants", async () => {
      const persist = spyOnPersist();
      const screen = await render(<ProtectionProbe browser="chromium" />);
      await expect.poll(() => latest?.status).toBeDefined();
      await latest.protect();
      const granted = await persist.mock.results[0]?.value;
      if (granted) {
        expect(latest.status).toBe("protected");
        expect(screen.getByText(CHROMIUM_DECLINED).elements()).toHaveLength(0);
      } else {
        await expect.element(screen.getByText(CHROMIUM_DECLINED)).toBeInTheDocument();
        expect(latest.status).toBe("unprotected");
      }
    });

    it("tells another browser's user the plain declined message", async () => {
      const persist = spyOnPersist();
      const screen = await render(<ProtectionProbe browser="other" />);
      await expect.poll(() => latest?.status).toBeDefined();
      await latest.protect();
      const granted = await persist.mock.results[0]?.value;
      if (granted) {
        expect(latest.status).toBe("protected");
        expect(screen.getByText(OTHER_DECLINED).elements()).toHaveLength(0);
      } else {
        await expect.element(screen.getByText(OTHER_DECLINED)).toBeInTheDocument();
        expect(latest.status).toBe("unprotected");
      }
    });
  });
});
