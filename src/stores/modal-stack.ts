import { create } from "zustand";

interface ModalStackState {
  stack: readonly symbol[];
  push: () => symbol;
  pop: (token: symbol) => void;
}

const useModalStackStore = create<ModalStackState>((set) => ({
  stack: [],
  push: () => {
    const token = Symbol("modal");
    set((s) => ({ stack: [...s.stack, token] }));
    return token;
  },
  pop: (token) => set((s) => ({ stack: s.stack.filter((open) => open !== token) })),
}));

function openModalCount(state: ModalStackState): number {
  return state.stack.length;
}

function isAnyModalOpen(): boolean {
  return openModalCount(useModalStackStore.getState()) > 0;
}

function isTopModal(token: symbol): boolean {
  const { stack } = useModalStackStore.getState();
  return stack[stack.length - 1] === token;
}

export { useModalStackStore, isAnyModalOpen, isTopModal, openModalCount };
