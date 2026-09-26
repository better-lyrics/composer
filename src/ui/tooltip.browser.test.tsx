import { describe, expect, it } from "vitest";
import { Tooltip } from "@/ui/tooltip";
import { useModalStackStore } from "@/stores/modal-stack";
import { render } from "@/test/render";
import { Modal } from "@/ui/modal";

describe("Tooltip", () => {
  it("renders the trigger element", async () => {
    const screen = await render(
      <Tooltip content="More info" delay={0}>
        <button type="button">Hover me</button>
      </Tooltip>,
    );
    await expect.element(screen.getByRole("button", { name: "Hover me" })).toBeInTheDocument();
  });

  it("does not show the tooltip content before interaction", async () => {
    // No delay={0}: the real hover delay keeps a stray harness mouseenter from opening the tooltip pre-assertion.
    await render(
      <Tooltip content="More info">
        <button type="button">Hover me</button>
      </Tooltip>,
    );
    expect(document.body.textContent).not.toContain("More info");
  });

  it("shows the tooltip on focus", async () => {
    const screen = await render(
      <Tooltip content="More info" delay={0}>
        <button type="button">Hover me</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Hover me" }).element() as HTMLElement;
    trigger.focus();
    await expect.element(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("closes when Escape is pressed", async () => {
    const screen = await render(
      <Tooltip content="More info" delay={0}>
        <button type="button">Hover me</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Hover me" }).element() as HTMLElement;
    trigger.focus();
    await expect.element(screen.getByRole("tooltip")).toBeInTheDocument();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await expect.element(screen.getByRole("tooltip")).not.toBeInTheDocument();
  });
});

describe("Tooltip surface inside modals", () => {
  it("uses the dark surface outside a modal", async () => {
    const screen = await render(
      <Tooltip content="Outside tip" delay={0}>
        <button type="button">Outside</button>
      </Tooltip>,
    );
    (screen.getByRole("button", { name: "Outside" }).element() as HTMLButtonElement).focus();
    await expect.element(screen.getByRole("tooltip")).toHaveClass("bg-composer-bg-dark");
  });

  it("uses the elevated surface while a modal is open so it does not blend into the modal", async () => {
    const screen = await render(
      <Modal isOpen onClose={() => {}} title="Dialog">
        <Tooltip content="Inside tip" delay={0}>
          <button type="button">Inside</button>
        </Tooltip>
      </Modal>,
    );
    await expect.poll(() => useModalStackStore.getState().count).toBe(1);
    await screen.getByRole("button", { name: "Inside" }).hover();
    const tooltip = screen.getByRole("tooltip");
    await expect.element(tooltip).toHaveClass("bg-composer-bg-elevated");
    await expect.element(tooltip).not.toHaveClass("bg-composer-bg-dark");
  });
});
