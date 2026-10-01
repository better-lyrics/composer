import { isAnyModalOpen, isTopModal, openModalCount, useModalStackStore } from "@/stores/modal-stack";
import { beforeEach, describe, expect, it } from "vitest";

// -- Tests --------------------------------------------------------------------

describe("modal stack", () => {
  beforeEach(() => {
    useModalStackStore.setState({ stack: [] });
  });

  it("counts open modals from the stack", () => {
    const { push } = useModalStackStore.getState();
    push();
    push();
    expect(openModalCount(useModalStackStore.getState())).toBe(2);
    expect(isAnyModalOpen()).toBe(true);
  });

  it("puts the newest modal on top", () => {
    const { push } = useModalStackStore.getState();
    const first = push();
    const second = push();
    expect(isTopModal(second)).toBe(true);
    expect(isTopModal(first)).toBe(false);
  });

  it("removes the closed modal even when it is not on top", () => {
    const { push, pop } = useModalStackStore.getState();
    const first = push();
    const second = push();
    pop(first);
    expect(isTopModal(second)).toBe(true);
    expect(openModalCount(useModalStackStore.getState())).toBe(1);
  });

  describe("edge cases", () => {
    it("reports nothing open on an empty stack", () => {
      expect(isAnyModalOpen()).toBe(false);
      expect(isTopModal(Symbol("stranger"))).toBe(false);
    });

    it("ignores a second close of the same modal", () => {
      const { push, pop } = useModalStackStore.getState();
      const first = push();
      const second = push();
      pop(second);
      pop(second);
      expect(isTopModal(first)).toBe(true);
      expect(openModalCount(useModalStackStore.getState())).toBe(1);
    });
  });

  describe("invariants", () => {
    it("gives every open modal its own token", () => {
      const { push } = useModalStackStore.getState();
      expect(push()).not.toBe(push());
    });
  });
});
