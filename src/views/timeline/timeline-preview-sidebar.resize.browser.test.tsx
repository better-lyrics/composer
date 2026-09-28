import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { render } from "@/test/render";
import { PREVIEW_SIDEBAR_WIDTH } from "@/utils/preview-sidebar-width";
import { TimelinePreviewSidebar } from "@/views/timeline/timeline-preview-sidebar";
import { Activity, useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Constants -----------------------------------------------------------------

const START_X = 1000;

// -- Helpers ------------------------------------------------------------------

async function renderSidebar() {
  const screen = await render(<TimelinePreviewSidebar />);
  const separator = screen.getByRole("separator", { name: "Resize preview" });
  await expect.element(separator).toBeInTheDocument();
  const sidebar = screen.getByRole("complementary", { name: "Lyrics preview" }).element();
  if (!(sidebar instanceof HTMLElement)) throw new Error("sidebar is not an element");
  return { screen, separator, sidebar };
}

function sidebarWidth(sidebar: HTMLElement): string {
  return sidebar.style.width;
}

function pressAt(target: Element, clientX: number): void {
  target.dispatchEvent(new PointerEvent("pointerdown", { clientX, button: 0, bubbles: true }));
}

function moveTo(clientX: number): void {
  document.dispatchEvent(new PointerEvent("pointermove", { clientX, bubbles: true }));
}

function cancelPointer(): void {
  document.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true }));
}

let setSidebarVisible: (visible: boolean) => void = () => {};

const ToggleHarness: React.FC = () => {
  const [visible, setVisible] = useState(true);
  setSidebarVisible = setVisible;
  return (
    <Activity mode={visible ? "visible" : "hidden"}>
      <TimelinePreviewSidebar />
    </Activity>
  );
};

function releaseAt(clientX: number): void {
  document.dispatchEvent(new PointerEvent("pointerup", { clientX, bubbles: true }));
}

beforeEach(() => {
  useProjectStore.setState({ lines: [] });
});

// -- Tests --------------------------------------------------------------------

describe("TimelinePreviewSidebar resize", () => {
  it("opens at the remembered width", async () => {
    useSettingsStore.setState({ previewSidebarWidth: 480 });
    const { sidebar, separator } = await renderSidebar();

    expect(sidebarWidth(sidebar)).toBe("480px");
    await expect.element(separator).toHaveAttribute("aria-valuenow", "480");
  });

  it("widens when the edge is dragged left and remembers the width on release", async () => {
    const { sidebar, separator } = await renderSidebar();

    pressAt(separator.element(), START_X);
    moveTo(START_X - 100);

    await expect.poll(() => sidebarWidth(sidebar)).toBe("420px");
    expect(useSettingsStore.getState().previewSidebarWidth).toBe(PREVIEW_SIDEBAR_WIDTH.default);

    releaseAt(START_X - 100);

    await expect.poll(() => useSettingsStore.getState().previewSidebarWidth).toBe(420);
    await expect.element(separator).toHaveAttribute("aria-valuenow", "420");
  });

  it("narrows when the edge is dragged right", async () => {
    useSettingsStore.setState({ previewSidebarWidth: 400 });
    const { sidebar, separator } = await renderSidebar();

    pressAt(separator.element(), START_X);
    moveTo(START_X + 60);
    releaseAt(START_X + 60);

    await expect.poll(() => sidebarWidth(sidebar)).toBe("340px");
    expect(useSettingsStore.getState().previewSidebarWidth).toBe(340);
  });

  it("resets to the default width on double-click", async () => {
    useSettingsStore.setState({ previewSidebarWidth: 500 });
    const { sidebar, separator } = await renderSidebar();

    separator.element().dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    await expect.poll(() => sidebarWidth(sidebar)).toBe(`${PREVIEW_SIDEBAR_WIDTH.default}px`);
    expect(useSettingsStore.getState().previewSidebarWidth).toBe(PREVIEW_SIDEBAR_WIDTH.default);
  });

  it("resizes from the keyboard without the keys reaching the Timeline", async () => {
    const { sidebar, separator } = await renderSidebar();
    const reachedWindow: string[] = [];
    const recordKey = (event: KeyboardEvent) => reachedWindow.push(event.key);
    window.addEventListener("keydown", recordKey);
    try {
      const handle = separator.element();
      if (!(handle instanceof HTMLElement)) throw new Error("separator is not an element");
      handle.focus();
      await userEvent.keyboard("{ArrowLeft}");
      await expect.poll(() => sidebarWidth(sidebar)).toBe(`${PREVIEW_SIDEBAR_WIDTH.default + 16}px`);

      await userEvent.keyboard("{ArrowRight}{ArrowRight}");
      await expect.poll(() => sidebarWidth(sidebar)).toBe(`${PREVIEW_SIDEBAR_WIDTH.default - 16}px`);
      expect(useSettingsStore.getState().previewSidebarWidth).toBe(PREVIEW_SIDEBAR_WIDTH.default - 16);
      expect(reachedWindow).toEqual([]);
    } finally {
      window.removeEventListener("keydown", recordKey);
    }
  });

  it("jumps to the minimum and maximum widths with Home and End", async () => {
    const { sidebar, separator } = await renderSidebar();
    const handle = separator.element();
    if (!(handle instanceof HTMLElement)) throw new Error("separator is not an element");
    handle.focus();

    await userEvent.keyboard("{Home}");
    await expect.poll(() => sidebarWidth(sidebar)).toBe(`${PREVIEW_SIDEBAR_WIDTH.min}px`);
    await userEvent.keyboard("{End}");

    await expect.poll(() => sidebarWidth(sidebar)).toBe(`${PREVIEW_SIDEBAR_WIDTH.max}px`);
    expect(useSettingsStore.getState().previewSidebarWidth).toBe(PREVIEW_SIDEBAR_WIDTH.max);
  });

  it("names the sidebar it resizes", async () => {
    const { sidebar, separator } = await renderSidebar();

    expect(sidebar.id).not.toBe("");
    await expect.element(separator).toHaveAttribute("aria-controls", sidebar.id);
  });

  describe("edge cases", () => {
    it("stops at the minimum and maximum widths", async () => {
      const { sidebar, separator } = await renderSidebar();

      pressAt(separator.element(), START_X);
      moveTo(START_X + 2000);
      await expect.poll(() => sidebarWidth(sidebar)).toBe(`${PREVIEW_SIDEBAR_WIDTH.min}px`);
      moveTo(START_X - 2000);
      await expect.poll(() => sidebarWidth(sidebar)).toBe(`${PREVIEW_SIDEBAR_WIDTH.max}px`);
      releaseAt(START_X - 2000);

      await expect.poll(() => useSettingsStore.getState().previewSidebarWidth).toBe(PREVIEW_SIDEBAR_WIDTH.max);
    });

    it("clamps an out-of-range remembered width", async () => {
      useSettingsStore.setState({ previewSidebarWidth: 5000 });
      const { sidebar } = await renderSidebar();

      expect(sidebarWidth(sidebar)).toBe(`${PREVIEW_SIDEBAR_WIDTH.max}px`);
    });

    it("ignores a secondary-button press", async () => {
      const { sidebar, separator } = await renderSidebar();

      separator
        .element()
        .dispatchEvent(new PointerEvent("pointerdown", { clientX: START_X, button: 2, bubbles: true }));
      moveTo(START_X - 100);
      releaseAt(START_X - 100);

      expect(sidebarWidth(sidebar)).toBe(`${PREVIEW_SIDEBAR_WIDTH.default}px`);
      expect(useSettingsStore.getState().previewSidebarWidth).toBe(PREVIEW_SIDEBAR_WIDTH.default);
    });
  });

  describe("regressions", () => {
    it("regression: a cancelled pointer ends the drag without saving it", async () => {
      const { sidebar, separator } = await renderSidebar();

      pressAt(separator.element(), START_X);
      moveTo(START_X - 100);
      await expect.poll(() => sidebarWidth(sidebar)).toBe("420px");
      cancelPointer();

      await expect.poll(() => sidebarWidth(sidebar)).toBe(`${PREVIEW_SIDEBAR_WIDTH.default}px`);
      moveTo(START_X - 200);
      releaseAt(START_X - 200);
      expect(sidebarWidth(sidebar)).toBe(`${PREVIEW_SIDEBAR_WIDTH.default}px`);
      expect(useSettingsStore.getState().previewSidebarWidth).toBe(PREVIEW_SIDEBAR_WIDTH.default);
    });

    it("regression: hiding the sidebar mid-drag drops the unsaved width", async () => {
      const screen = await render(<ToggleHarness />);
      const separator = screen.getByRole("separator", { name: "Resize preview" });
      pressAt(separator.element(), START_X);
      moveTo(START_X - 100);
      await expect.element(separator).toHaveAttribute("aria-valuenow", "420");

      setSidebarVisible(false);
      await expect.poll(() => screen.container.querySelector<HTMLElement>("aside")?.style.display).toBe("none");
      setSidebarVisible(true);

      await expect.element(separator).toHaveAttribute("aria-valuenow", String(PREVIEW_SIDEBAR_WIDTH.default));
      expect(useSettingsStore.getState().previewSidebarWidth).toBe(PREVIEW_SIDEBAR_WIDTH.default);
    });

    it("regression: a second press replaces the first drag instead of stacking listeners", async () => {
      const { sidebar, separator } = await renderSidebar();

      pressAt(separator.element(), START_X);
      pressAt(separator.element(), START_X);
      moveTo(START_X - 40);
      releaseAt(START_X - 40);
      moveTo(START_X - 300);

      await expect.poll(() => sidebarWidth(sidebar)).toBe(`${PREVIEW_SIDEBAR_WIDTH.default + 40}px`);
      expect(useSettingsStore.getState().previewSidebarWidth).toBe(PREVIEW_SIDEBAR_WIDTH.default + 40);
    });
  });

  describe("invariants", () => {
    it("stops following the pointer after release", async () => {
      const { sidebar, separator } = await renderSidebar();

      pressAt(separator.element(), START_X);
      moveTo(START_X - 50);
      releaseAt(START_X - 50);
      moveTo(START_X - 300);

      await expect.poll(() => sidebarWidth(sidebar)).toBe(`${PREVIEW_SIDEBAR_WIDTH.default + 50}px`);
      expect(useSettingsStore.getState().previewSidebarWidth).toBe(PREVIEW_SIDEBAR_WIDTH.default + 50);
    });

    it("follows a width change made elsewhere, such as resetting settings", async () => {
      useSettingsStore.setState({ previewSidebarWidth: 500 });
      const { sidebar } = await renderSidebar();

      useSettingsStore.getState().resetToDefaults();

      await expect.poll(() => sidebarWidth(sidebar)).toBe(`${PREVIEW_SIDEBAR_WIDTH.default}px`);
    });
  });
});
