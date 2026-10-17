import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { Popover } from "@/ui/popover";
import { render } from "@/test/render";

describe("Popover", () => {
  it("renders the trigger and keeps the popover content hidden initially", async () => {
    const screen = await render(
      <Popover trigger={<button type="button">Open</button>}>
        <div>Popover body</div>
      </Popover>,
    );
    await expect.element(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("Popover body");
  });

  it("opens the popover when the trigger is clicked", async () => {
    const screen = await render(
      <Popover trigger={<button type="button">Open</button>}>
        <div>Popover body</div>
      </Popover>,
    );
    await screen.getByRole("button", { name: "Open" }).click();
    await expect.element(screen.getByText("Popover body")).toBeInTheDocument();
  });

  it("closes when Escape is pressed", async () => {
    const screen = await render(
      <Popover trigger={<button type="button">Open</button>}>
        <div>Popover body</div>
      </Popover>,
    );
    await screen.getByRole("button", { name: "Open" }).click();
    await expect.element(screen.getByText("Popover body")).toBeInTheDocument();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await expect.element(screen.getByText("Popover body")).not.toBeInTheDocument();
  });

  it("invokes the children render-prop with a close handler", async () => {
    let closes = 0;
    const screen = await render(
      <Popover trigger={<button type="button">Open</button>}>
        {(close) => (
          <button
            type="button"
            onClick={() => {
              closes++;
              close();
            }}
          >
            Dismiss
          </button>
        )}
      </Popover>,
    );
    await screen.getByRole("button", { name: "Open" }).click();
    await screen.getByRole("button", { name: "Dismiss" }).click();
    expect(closes).toBe(1);
    await expect.element(screen.getByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
  });

  it("announces a dialog popup by default", async () => {
    const screen = await render(
      <Popover trigger={<button type="button">Open</button>}>
        <p>Body</p>
      </Popover>,
    );
    await expect.element(screen.getByRole("button", { name: "Open" })).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("announces the popup kind it is given", async () => {
    const screen = await render(
      <Popover hasPopup="listbox" trigger={<button type="button">Open</button>}>
        <p>Body</p>
      </Popover>,
    );
    await expect.element(screen.getByRole("button", { name: "Open" })).toHaveAttribute("aria-haspopup", "listbox");
  });

  describe("controlled", () => {
    it("shows the content when open is true, without a click", async () => {
      const screen = await render(
        <Popover open onOpenChange={() => undefined} trigger={<button type="button">Open</button>}>
          <div>Controlled body</div>
        </Popover>,
      );
      await expect.element(screen.getByText("Controlled body")).toBeInTheDocument();
    });

    it("asks the owner to open on a trigger click and leaves the state to the owner", async () => {
      const requests: boolean[] = [];
      const screen = await render(
        <Popover
          open={false}
          onOpenChange={(next) => requests.push(next)}
          trigger={<button type="button">Open</button>}
        >
          <div>Controlled body</div>
        </Popover>,
      );
      await screen.getByRole("button", { name: "Open" }).click();
      expect(requests).toEqual([true]);
      expect(document.body.textContent).not.toContain("Controlled body");
    });

    it("asks the owner to close on Escape", async () => {
      const requests: boolean[] = [];
      await render(
        <Popover open onOpenChange={(next) => requests.push(next)} trigger={<button type="button">Open</button>}>
          <div>Controlled body</div>
        </Popover>,
      );
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await expect.poll(() => requests).toEqual([false]);
    });

    it("asks the owner to close on an outside click", async () => {
      const requests: boolean[] = [];
      await render(
        <Popover open onOpenChange={(next) => requests.push(next)} trigger={<button type="button">Open</button>}>
          <div>Controlled body</div>
        </Popover>,
      );
      document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await expect.poll(() => requests).toEqual([false]);
    });

    it("requests open on Enter when the trigger is focused", async () => {
      const requests: boolean[] = [];
      const screen = await render(
        <Popover
          open={false}
          onOpenChange={(next) => requests.push(next)}
          trigger={<button type="button">Open</button>}
        >
          <div>Controlled body</div>
        </Popover>,
      );
      (screen.getByRole("button", { name: "Open" }).element() as HTMLButtonElement).focus();
      await userEvent.keyboard("{Enter}");
      expect(requests).toEqual([true]);
    });

    it("the close render-prop asks the owner to close", async () => {
      const requests: boolean[] = [];
      const screen = await render(
        <Popover open onOpenChange={(next) => requests.push(next)} trigger={<button type="button">Open</button>}>
          {(close) => (
            <button type="button" onClick={close}>
              Done
            </button>
          )}
        </Popover>,
      );
      await screen.getByRole("button", { name: "Done" }).click();
      expect(requests).toEqual([false]);
    });

    it("names the floating element", async () => {
      const screen = await render(
        <Popover
          open
          onOpenChange={() => undefined}
          aria-label="Switch project"
          trigger={<button type="button">Open</button>}
        >
          <div>Controlled body</div>
        </Popover>,
      );
      await expect.element(screen.getByRole("dialog", { name: "Switch project" })).toBeInTheDocument();
    });
  });
});
