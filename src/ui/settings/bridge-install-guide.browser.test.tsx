import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { BridgeInstallGuide } from "@/ui/settings/bridge-install-guide";

// -- Constants ----------------------------------------------------------------

const UA = {
  macArm:
    "Mozilla/5.0 (Macintosh; ARM64 Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  macIntel:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  linux: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  unknown: "Mozilla/5.0 (PlayStation 6; iPad; Apple TV)",
} as const;

// -- Tests --------------------------------------------------------------------

describe("BridgeInstallGuide", () => {
  it("renders all four numbered steps", async () => {
    const screen = await render(<BridgeInstallGuide onCheckNow={() => {}} uaOverride={UA.macArm} />);
    await expect.element(screen.getByRole("heading", { name: /Download/ })).toBeInTheDocument();
    await expect.element(screen.getByRole("heading", { name: /Install/ })).toBeInTheDocument();
    await expect.element(screen.getByRole("heading", { name: /Launch/ })).toBeInTheDocument();
    await expect.element(screen.getByRole("heading", { name: /Return here/ })).toBeInTheDocument();
  });

  it("offers both macOS architectures when UA reports Apple Silicon", async () => {
    const screen = await render(<BridgeInstallGuide onCheckNow={() => {}} uaOverride={UA.macArm} />);
    const apple = screen.getByRole("link", { name: /macOS \(Apple Silicon\)/ });
    const intel = screen.getByRole("link", { name: /macOS \(Intel\)/ });
    await expect.element(apple).toHaveAttribute("href", expect.stringContaining("darwin-arm64.dmg"));
    await expect.element(intel).toHaveAttribute("href", expect.stringContaining("darwin-amd64.dmg"));
  });

  it("links Windows UA to the Setup.exe", async () => {
    const screen = await render(<BridgeInstallGuide onCheckNow={() => {}} uaOverride={UA.windows} />);
    const cta = screen.getByRole("link", { name: /Download for Windows/ });
    await expect.element(cta).toHaveAttribute("href", expect.stringContaining("Composer-Bridge-Setup.exe"));
  });

  it("links Linux UA to the AppImage", async () => {
    const screen = await render(<BridgeInstallGuide onCheckNow={() => {}} uaOverride={UA.linux} />);
    const cta = screen.getByRole("link", { name: /Download for Linux/ });
    await expect.element(cta).toHaveAttribute("href", expect.stringContaining("composer-bridge.AppImage"));
  });

  it("falls back to releases page on unknown UA", async () => {
    const screen = await render(<BridgeInstallGuide onCheckNow={() => {}} uaOverride={UA.unknown} />);
    const cta = screen.getByRole("link", { name: /See all releases/ });
    await expect
      .element(cta)
      .toHaveAttribute("href", "https://github.com/better-lyrics/composer-bridge/releases/latest");
  });

  it("calls onCheckNow when the Check now button is clicked", async () => {
    let checked = 0;
    const screen = await render(
      <BridgeInstallGuide
        onCheckNow={() => {
          checked += 1;
        }}
        uaOverride={UA.macArm}
      />,
    );
    await screen.getByRole("button", { name: /Check now/ }).click();
    await expect.poll(() => checked).toBe(1);
  });

  it("renders the Mac install copy when UA is Mac", async () => {
    const screen = await render(<BridgeInstallGuide onCheckNow={() => {}} uaOverride={UA.macArm} />);
    await expect.element(screen.getByText(/drag Composer Bridge to Applications/)).toBeInTheDocument();
  });

  it("renders the Windows install copy when UA is Windows", async () => {
    const screen = await render(<BridgeInstallGuide onCheckNow={() => {}} uaOverride={UA.windows} />);
    await expect.element(screen.getByText(/SmartScreen/)).toBeInTheDocument();
  });

  it("always exposes an Other platforms link to the releases page", async () => {
    const screen = await render(<BridgeInstallGuide onCheckNow={() => {}} uaOverride={UA.linux} />);
    const other = screen.getByRole("link", { name: /Other platforms/ });
    await expect
      .element(other)
      .toHaveAttribute("href", "https://github.com/better-lyrics/composer-bridge/releases/latest");
  });
});
