import { useSettingsStore } from "@/stores/settings";
import { installUtilitiesUsedIn } from "@/test/browser-css";
import { render } from "@/test/render";
import { SelectSetting, SettingsGroup, SliderSetting, ToggleSetting } from "@/ui/settings/setting-controls";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers -------------------------------------------------------------------

function setRangeValue(input: HTMLInputElement, value: number): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, String(value));
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function sliderControlsWidth(rowWidth: number): Promise<number> {
  const screen = await render(
    <div style={{ width: rowWidth }}>
      <SliderSetting
        id="defaultZoom"
        min={20}
        max={500}
        step={20}
        format={(v) => `${v} px/s`}
        action={{ label: "Use current", onClick: () => {} }}
      />
    </div>,
  );
  const utilities = await installUtilitiesUsedIn(screen.container);
  const controls = screen.getByRole("button", { name: "Use current" }).element().parentElement as HTMLElement;
  const width = controls.getBoundingClientRect().width;
  utilities.remove();
  await screen.unmount();
  return width;
}

const GRANULARITY_OPTIONS = [
  { value: "word", label: "Word" },
  { value: "line", label: "Line" },
];

// -- Tests ---------------------------------------------------------------------

describe("SliderSetting", () => {
  it("shows the catalog label and description", async () => {
    const screen = await render(<SliderSetting id="defaultZoom" min={20} max={500} step={20} />);
    await expect.element(screen.getByText("Default zoom")).toBeInTheDocument();
    await expect
      .element(screen.getByText("Initial zoom level (px/sec) when opening the timeline."))
      .toBeInTheDocument();
  });

  it("displays the formatted current value from the store", async () => {
    useSettingsStore.setState({ defaultZoom: 100 });
    const screen = await render(
      <SliderSetting id="defaultZoom" min={20} max={500} step={20} format={(v) => `${v} px/s`} />,
    );
    await expect.element(screen.getByText("100 px/s")).toBeInTheDocument();
  });

  it("writes the new value to the store on change", async () => {
    useSettingsStore.setState({ defaultZoom: 100 });
    const screen = await render(<SliderSetting id="defaultZoom" min={20} max={500} step={20} />);
    setRangeValue(screen.getByRole("slider").element() as HTMLInputElement, 260);
    await expect.poll(() => useSettingsStore.getState().defaultZoom).toBe(260);
  });

  it("labels the slider with the catalog label", async () => {
    const screen = await render(<SliderSetting id="defaultZoom" min={20} max={500} step={20} />);
    await expect.element(screen.getByRole("slider", { name: "Default zoom" })).toBeInTheDocument();
  });

  it("invokes the action callback when the action button is clicked", async () => {
    let invoked = false;
    const screen = await render(
      <SliderSetting
        id="defaultZoom"
        min={20}
        max={500}
        step={20}
        action={{
          label: "Use current",
          onClick: () => {
            invoked = true;
          },
        }}
      />,
    );
    await screen.getByRole("button", { name: "Use current" }).click();
    await expect.poll(() => invoked).toBe(true);
  });

  describe("regressions", () => {
    it("regression: keeps the value and its action at full width when the row is narrow", async () => {
      const wide = await sliderControlsWidth(800);
      expect(await sliderControlsWidth(220)).toBe(wide);
    });
  });
});

describe("ToggleSetting", () => {
  it("reflects the store value via aria-checked", async () => {
    useSettingsStore.setState({ followPlayhead: true });
    const screen = await render(<ToggleSetting id="followPlayhead" />);
    await expect
      .element(screen.getByRole("switch", { name: "Follow playhead" }))
      .toHaveAttribute("aria-checked", "true");
  });

  it("flips the store value when clicked", async () => {
    useSettingsStore.setState({ followPlayhead: true });
    const screen = await render(<ToggleSetting id="followPlayhead" />);
    await screen.getByRole("switch").click();
    await expect.poll(() => useSettingsStore.getState().followPlayhead).toBe(false);
  });

  it("flips the store value from the keyboard", async () => {
    useSettingsStore.setState({ followPlayhead: false });
    const screen = await render(<ToggleSetting id="followPlayhead" />);
    (screen.getByRole("switch").element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => useSettingsStore.getState().followPlayhead).toBe(true);
  });
});

describe("SelectSetting", () => {
  it("reflects the store value as the selected option", async () => {
    useSettingsStore.setState({ defaultGranularity: "line" });
    const screen = await render(<SelectSetting id="defaultGranularity" options={GRANULARITY_OPTIONS} />);
    await expect.element(screen.getByRole("button", { name: "Default granularity" })).toHaveTextContent("Line");
  });

  it("writes the chosen option to the store", async () => {
    useSettingsStore.setState({ defaultGranularity: "word" });
    const screen = await render(<SelectSetting id="defaultGranularity" options={GRANULARITY_OPTIONS} />);
    await screen.getByRole("button", { name: "Default granularity" }).click();
    await screen.getByRole("option", { name: "Line" }).click();
    await expect.poll(() => useSettingsStore.getState().defaultGranularity).toBe("line");
  });
});

describe("SettingsGroup", () => {
  it("labels its rows with the group title", async () => {
    const screen = await render(
      <SettingsGroup title="Usage">
        <p>Row</p>
      </SettingsGroup>,
    );
    await expect.element(screen.getByRole("region", { name: "Usage" })).toBeInTheDocument();
    await expect.element(screen.getByRole("heading", { name: "Usage", level: 3 })).toBeInTheDocument();
  });
});
