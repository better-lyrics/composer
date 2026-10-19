import { HELP_CONTENT_SCROLLER_CSS, installStyleSheet } from "@/test/browser-css";
import { holdIdleCallbacks, releaseIdleCallbacks } from "@/test/idle-callbacks";
import { render } from "@/test/render";
import { HelpModal } from "@/ui/help-modal";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

function frozenTopic(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-help-topic="The app is frozen"]');
}

function contentViewport(): HTMLElement | null {
  return (
    document.querySelector("[data-help-content]")?.closest<HTMLElement>("[data-overlayscrollbars-viewport]") ?? null
  );
}

async function openTopicFromSearch() {
  const screen = await render(<HelpModal isOpen onClose={() => {}} />);
  await expect.poll(() => document.querySelector("dialog")?.contains(document.activeElement)).toBe(true);
  await screen.getByRole("textbox", { name: "Search help" }).fill("frozen");
  const open = screen.getByRole("button", { name: "Open The app is frozen" }).element();
  if (!(open instanceof HTMLElement)) throw new Error("open button missing");
  open.focus();
  await userEvent.keyboard("{Enter}");
  await expect.element(screen.getByRole("button", { name: "Recovery" })).toHaveAttribute("aria-current", "page");
  return screen;
}

beforeEach(() => {
  installStyleSheet(HELP_CONTENT_SCROLLER_CSS);
});

afterEach(() => {
  releaseIdleCallbacks();
});

// -- Tests --------------------------------------------------------------------

describe("HelpModal topic reveal", () => {
  it("nudges the opened topic once the scroller is ready", async () => {
    await openTopicFromSearch();

    await expect.poll(() => frozenTopic()?.hasAttribute("data-nudge")).toBe(true);
  });

  describe("regressions", () => {
    it("regression: reveals a topic opened before the scroller initializes", async () => {
      holdIdleCallbacks();
      await openTopicFromSearch();
      expect(contentViewport()).toBeNull();
      expect(frozenTopic()?.hasAttribute("data-nudge")).toBe(false);

      releaseIdleCallbacks();

      await expect.poll(() => contentViewport()).not.toBeNull();
      await expect.poll(() => frozenTopic()?.hasAttribute("data-nudge")).toBe(true);
    });

    it("regression: scrolls the late-revealed topic into the viewport", async () => {
      holdIdleCallbacks();
      await openTopicFromSearch();

      releaseIdleCallbacks();

      await expect.poll(() => frozenTopic()?.hasAttribute("data-nudge")).toBe(true);
      const viewport = contentViewport();
      const topic = frozenTopic();
      if (!viewport || !topic) throw new Error("viewport or topic missing");
      const viewportRect = viewport.getBoundingClientRect();
      const topicRect = topic.getBoundingClientRect();
      expect(topicRect.top).toBeLessThan(viewportRect.bottom);
      expect(topicRect.bottom).toBeGreaterThan(viewportRect.top);
    });
  });

  describe("invariants", () => {
    it("reveals a pending topic once, so revisiting its section later does not nudge again", async () => {
      holdIdleCallbacks();
      const screen = await openTopicFromSearch();
      releaseIdleCallbacks();
      await expect.poll(() => frozenTopic()?.hasAttribute("data-nudge")).toBe(true);

      await screen.getByRole("button", { name: "About" }).click();
      await expect.poll(() => frozenTopic()).toBeNull();
      await screen.getByRole("button", { name: "Recovery" }).click();

      await expect.poll(() => frozenTopic()).not.toBeNull();
      expect(frozenTopic()?.hasAttribute("data-nudge")).toBe(false);
    });
  });
});
