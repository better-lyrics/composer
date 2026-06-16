import { describe, expect, it } from "vitest";
import { DEFAULT_BRIDGE_URL } from "@/utils/composer-bridge-api";
import { BridgeUrlField } from "@/ui/settings/bridge-url-field";
import { render } from "@/test/render";

// -- Helpers ------------------------------------------------------------------

function getInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="url"]');
  if (!input) throw new Error("URL input not rendered");
  return input;
}

function typeInto(input: HTMLInputElement, next: string): void {
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  nativeSetter?.call(input, next);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

// -- Tests --------------------------------------------------------------------

describe("BridgeUrlField", () => {
  it("seeds the input from initialUrl", async () => {
    await render(<BridgeUrlField initialUrl="http://localhost:9999" onCommit={() => {}} onReset={() => {}} />);
    expect(getInput().value).toBe("http://localhost:9999");
  });

  it("commits the edited value on blur", async () => {
    let committed: string | null = null;
    await render(
      <BridgeUrlField
        initialUrl={DEFAULT_BRIDGE_URL}
        onCommit={(url) => {
          committed = url;
        }}
        onReset={() => {}}
      />,
    );
    const input = getInput();
    input.focus();
    typeInto(input, "http://localhost:1234");
    input.blur();
    expect(committed).toBe("http://localhost:1234");
  });

  it("commits on Enter", async () => {
    let committed: string | null = null;
    await render(
      <BridgeUrlField
        initialUrl={DEFAULT_BRIDGE_URL}
        onCommit={(url) => {
          committed = url;
        }}
        onReset={() => {}}
      />,
    );
    const input = getInput();
    input.focus();
    typeInto(input, "http://localhost:5678");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(committed).toBe("http://localhost:5678");
  });

  it("hides the reset control when the value equals the default", async () => {
    await render(<BridgeUrlField initialUrl={DEFAULT_BRIDGE_URL} onCommit={() => {}} onReset={() => {}} />);
    expect(document.querySelector("button")).toBeNull();
  });

  it("shows the reset control and fires onReset when the value differs from the default", async () => {
    let resets = 0;
    const screen = await render(
      <BridgeUrlField
        initialUrl="http://localhost:9999"
        onCommit={() => {}}
        onReset={() => {
          resets += 1;
        }}
      />,
    );
    await screen.getByRole("button", { name: /Reset/i }).click();
    expect(resets).toBe(1);
  });

  describe("edge cases", () => {
    it("commits an empty string when the field is cleared", async () => {
      let committed: string | null = null;
      await render(
        <BridgeUrlField
          initialUrl="http://localhost:9999"
          onCommit={(url) => {
            committed = url;
          }}
          onReset={() => {}}
        />,
      );
      const input = getInput();
      input.focus();
      typeInto(input, "");
      input.blur();
      expect(committed).toBe("");
    });

    it("re-seeds the draft when initialUrl changes via a key remount", async () => {
      const screen = await render(
        <BridgeUrlField key="http://a" initialUrl="http://a" onCommit={() => {}} onReset={() => {}} />,
      );
      expect(getInput().value).toBe("http://a");
      typeInto(getInput(), "http://edited");
      await screen.rerender(
        <BridgeUrlField key="http://b" initialUrl="http://b" onCommit={() => {}} onReset={() => {}} />,
      );
      expect(getInput().value).toBe("http://b");
    });
  });
});
