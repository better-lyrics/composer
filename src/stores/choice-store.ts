import type { ReactNode } from "react";
import { toast } from "sonner";
import { create } from "zustand";

// -- Types --------------------------------------------------------------------

type ChoiceVariant = "primary" | "secondary" | "destructive";

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  variant: ChoiceVariant;
}

interface ChoiceRequest<T extends string> {
  title: string;
  body: ReactNode;
  busyMessage: string;
  options: readonly ChoiceOption<T>[];
}

type ChoiceAnswer<T extends string> = T | "cancel";

interface ChoiceState {
  request: ChoiceRequest<string> | null;
  resolveIndex: ((index: number) => void) | null;
  answer: (value: string) => void;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Choice]";
const CANCELLED = -1;

// -- Store --------------------------------------------------------------------

const useChoiceStore = create<ChoiceState>((set, get) => ({
  request: null,
  resolveIndex: null,

  answer: (value) => {
    const { request, resolveIndex } = get();
    if (!request || !resolveIndex) return;
    set({ request: null, resolveIndex: null });
    resolveIndex(request.options.findIndex((option) => option.value === value));
  },
}));

function askChoice<T extends string>(request: ChoiceRequest<T>): Promise<ChoiceAnswer<T>> {
  if (useChoiceStore.getState().request) {
    console.warn(LOG_PREFIX, "a choice prompt is already open; cancelling the second one");
    toast.warning(request.busyMessage);
    return Promise.resolve("cancel");
  }
  return new Promise<ChoiceAnswer<T>>((resolve) => {
    useChoiceStore.setState({
      request,
      resolveIndex: (index) => resolve(index === CANCELLED ? "cancel" : request.options[index].value),
    });
  });
}

// -- Exports ------------------------------------------------------------------

export { askChoice, useChoiceStore };
export type { ChoiceRequest };
