import { useEscapeLayer } from "@/hooks/useEscapeLayer";
import { openModalCount, useModalStackStore } from "@/stores/modal-stack";
import { render } from "@/test/render";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

const Layer: React.FC<{ active: boolean; onEscape: () => void }> = ({ active, onEscape }) => {
  useEscapeLayer(active, onEscape);
  return null;
};

// -- Tests --------------------------------------------------------------------

describe("useEscapeLayer", () => {
  it("runs only the newest active layer on Escape", async () => {
    const closed: string[] = [];
    await render(
      <>
        <Layer active onEscape={() => closed.push("settings")} />
        <Layer active onEscape={() => closed.push("editor")} />
      </>,
    );
    await userEvent.keyboard("{Escape}");
    expect(closed).toEqual(["editor"]);
  });

  it("joins the modal stack only while active", async () => {
    const screen = await render(<Layer active={false} onEscape={() => {}} />);
    expect(openModalCount(useModalStackStore.getState())).toBe(0);
    await screen.rerender(<Layer active onEscape={() => {}} />);
    expect(openModalCount(useModalStackStore.getState())).toBe(1);
    await screen.rerender(<Layer active={false} onEscape={() => {}} />);
    expect(openModalCount(useModalStackStore.getState())).toBe(0);
  });

  it("ignores other keys", async () => {
    let escapes = 0;
    await render(<Layer active onEscape={() => escapes++} />);
    await userEvent.keyboard("{Enter}a");
    expect(escapes).toBe(0);
  });
});
