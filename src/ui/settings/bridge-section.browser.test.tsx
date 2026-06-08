import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "@/test/render";
import { useSettingsStore } from "@/stores/settings";
import { BridgeSection } from "@/ui/settings/bridge-section";
import { DEFAULT_BRIDGE_URL } from "@/utils/composer-bridge-api";

// -- Helpers ------------------------------------------------------------------

function withQueryClient(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY },
    },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// -- Tests --------------------------------------------------------------------

describe("BridgeSection", () => {
  it("renders the mixed-case 'Experimental' badge without uppercase transform", async () => {
    const screen = await render(withQueryClient(<BridgeSection />));
    const badge = screen.getByText("Experimental");
    await expect.element(badge).toBeInTheDocument();
    const className = badge.element().className;
    expect(className).not.toContain("uppercase");
  });

  it("only renders the URL input once the bridge toggle is enabled", async () => {
    useSettingsStore.setState({ experiments: { youtubeBridge: false } });
    const screen = await render(withQueryClient(<BridgeSection />));
    await expect.element(screen.getByRole("switch", { name: /Composer Bridge/ })).toBeInTheDocument();
    expect(screen.container.querySelector('input[type="url"]')).toBeNull();
  });

  it("shows the URL input when the toggle flips on and seeds it with the persisted value", async () => {
    useSettingsStore.setState({
      experiments: { youtubeBridge: true },
      composerBridgeUrl: "http://localhost:9000",
    });
    const screen = await render(withQueryClient(<BridgeSection />));
    const input = screen.container.querySelector('input[type="url"]');
    expect(input).not.toBeNull();
    expect((input as HTMLInputElement).value).toBe("http://localhost:9000");
  });

  it("defers persisting the URL until the input blurs", async () => {
    useSettingsStore.setState({
      experiments: { youtubeBridge: true },
      composerBridgeUrl: DEFAULT_BRIDGE_URL,
    });
    const screen = await render(withQueryClient(<BridgeSection />));
    const input = screen.container.querySelector('input[type="url"]') as HTMLInputElement;

    await userEvent.click(input);
    await userEvent.fill(input, "http://localhost:9999");
    expect(useSettingsStore.getState().composerBridgeUrl).toBe(DEFAULT_BRIDGE_URL);

    await userEvent.tab();
    await expect.poll(() => useSettingsStore.getState().composerBridgeUrl).toBe("http://localhost:9999");
  });

  it("commits the URL on Enter via the input's blur path", async () => {
    useSettingsStore.setState({
      experiments: { youtubeBridge: true },
      composerBridgeUrl: DEFAULT_BRIDGE_URL,
    });
    const screen = await render(withQueryClient(<BridgeSection />));
    const input = screen.container.querySelector('input[type="url"]') as HTMLInputElement;

    await userEvent.click(input);
    await userEvent.fill(input, "http://localhost:8000");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => useSettingsStore.getState().composerBridgeUrl).toBe("http://localhost:8000");
  });

  it("hides the reset button while the persisted URL matches the default", async () => {
    useSettingsStore.setState({
      experiments: { youtubeBridge: true },
      composerBridgeUrl: DEFAULT_BRIDGE_URL,
    });
    const screen = await render(withQueryClient(<BridgeSection />));
    expect(screen.container.querySelector('button[type="button"]:not([role])')).toBeNull();
  });

  it("shows the reset button when persisted URL differs and reverts to default on click", async () => {
    useSettingsStore.setState({
      experiments: { youtubeBridge: true },
      composerBridgeUrl: "http://localhost:8000",
    });
    const screen = await render(withQueryClient(<BridgeSection />));
    const reset = screen.getByRole("button", { name: /Reset/ });
    await expect.element(reset).toBeInTheDocument();
    await reset.click();
    await expect.poll(() => useSettingsStore.getState().composerBridgeUrl).toBe(DEFAULT_BRIDGE_URL);
  });
});
