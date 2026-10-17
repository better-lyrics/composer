import {
  isAnyModalOpen,
  isPanelOnTop,
  isTopEscapeLayer,
  openModalCount,
  useEscapeLayerStackStore,
} from "@/stores/escape-layer-stack";
import { beforeEach, describe, expect, it } from "vitest";

// -- Tests --------------------------------------------------------------------

describe("escape layer stack", () => {
  beforeEach(() => {
    useEscapeLayerStackStore.setState({ layers: [] });
  });

  it("counts open modals from the stack", () => {
    const { push } = useEscapeLayerStackStore.getState();
    push("modal");
    push("modal");
    expect(openModalCount(useEscapeLayerStackStore.getState())).toBe(2);
    expect(isAnyModalOpen()).toBe(true);
  });

  it("puts the newest layer on top", () => {
    const { push } = useEscapeLayerStackStore.getState();
    const first = push("modal");
    const second = push("modal");
    expect(isTopEscapeLayer(second)).toBe(true);
    expect(isTopEscapeLayer(first)).toBe(false);
  });

  it("removes the closed layer even when it is not on top", () => {
    const { push, pop } = useEscapeLayerStackStore.getState();
    const first = push("modal");
    const second = push("modal");
    pop(first);
    expect(isTopEscapeLayer(second)).toBe(true);
    expect(openModalCount(useEscapeLayerStackStore.getState())).toBe(1);
  });

  describe("panels", () => {
    it("puts a panel on top of the modal it opened in", () => {
      const { push } = useEscapeLayerStackStore.getState();
      const modal = push("modal");
      const panel = push("panel");
      expect(isTopEscapeLayer(panel)).toBe(true);
      expect(isTopEscapeLayer(modal)).toBe(false);
      expect(isPanelOnTop()).toBe(true);
    });

    it("does not count a panel as an open modal", () => {
      const { push } = useEscapeLayerStackStore.getState();
      push("modal");
      push("panel");
      expect(openModalCount(useEscapeLayerStackStore.getState())).toBe(1);
    });

    it("reports no modal open when only a panel is on the stack", () => {
      useEscapeLayerStackStore.getState().push("panel");
      expect(isAnyModalOpen()).toBe(false);
    });

    it("hands the top back to the modal when the panel closes", () => {
      const { push, pop } = useEscapeLayerStackStore.getState();
      const modal = push("modal");
      pop(push("panel"));
      expect(isTopEscapeLayer(modal)).toBe(true);
      expect(isPanelOnTop()).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("reports nothing open on an empty stack", () => {
      expect(isAnyModalOpen()).toBe(false);
      expect(isPanelOnTop()).toBe(false);
      expect(isTopEscapeLayer(Symbol("stranger"))).toBe(false);
    });

    it("ignores a second close of the same layer", () => {
      const { push, pop } = useEscapeLayerStackStore.getState();
      const first = push("modal");
      const second = push("modal");
      pop(second);
      pop(second);
      expect(isTopEscapeLayer(first)).toBe(true);
      expect(openModalCount(useEscapeLayerStackStore.getState())).toBe(1);
    });
  });

  describe("invariants", () => {
    it("gives every open layer its own token", () => {
      const { push } = useEscapeLayerStackStore.getState();
      expect(push("modal")).not.toBe(push("modal"));
      expect(push("panel")).not.toBe(push("panel"));
    });
  });
});
