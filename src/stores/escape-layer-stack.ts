import { create } from "zustand";

type EscapeLayerKind = "modal" | "panel";

interface EscapeLayer {
  token: symbol;
  kind: EscapeLayerKind;
}

interface EscapeLayerStackState {
  layers: readonly EscapeLayer[];
  push: (kind: EscapeLayerKind) => symbol;
  pop: (token: symbol) => void;
}

const useEscapeLayerStackStore = create<EscapeLayerStackState>((set) => ({
  layers: [],
  push: (kind) => {
    const token = Symbol(kind);
    set((s) => ({ layers: [...s.layers, { token, kind }] }));
    return token;
  },
  pop: (token) => set((s) => ({ layers: s.layers.filter((layer) => layer.token !== token) })),
}));

function openModalCount(state: EscapeLayerStackState): number {
  return state.layers.reduce((count, layer) => (layer.kind === "modal" ? count + 1 : count), 0);
}

function isAnyModalOpen(): boolean {
  return openModalCount(useEscapeLayerStackStore.getState()) > 0;
}

function topLayer(): EscapeLayer | undefined {
  return useEscapeLayerStackStore.getState().layers.at(-1);
}

function isTopEscapeLayer(token: symbol): boolean {
  return topLayer()?.token === token;
}

function isPanelOnTop(): boolean {
  return topLayer()?.kind === "panel";
}

export { useEscapeLayerStackStore, isAnyModalOpen, isPanelOnTop, isTopEscapeLayer, openModalCount };
export type { EscapeLayerKind };
