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

interface ChoiceCheckbox {
  label: string;
}

interface CheckboxChoiceRequest<T extends string> extends ChoiceRequest<T> {
  checkbox: ChoiceCheckbox;
}

type ChoiceAnswer<T extends string> = T | "cancel";

interface CheckedChoice<T extends string> {
  answer: ChoiceAnswer<T>;
  checked: boolean;
}

interface ChoiceState {
  request: (ChoiceRequest<string> & { checkbox?: ChoiceCheckbox }) | null;
  checked: boolean;
  resolveIndex: ((index: number, checked: boolean) => void) | null;
  setChecked: (checked: boolean) => void;
  answer: (value: string) => void;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Choice]";
const CANCELLED = -1;

// -- Store --------------------------------------------------------------------

const useChoiceStore = create<ChoiceState>((set, get) => ({
  request: null,
  checked: false,
  resolveIndex: null,

  setChecked: (checked) => set({ checked }),

  answer: (value) => {
    const { request, checked, resolveIndex } = get();
    if (!request || !resolveIndex) return;
    set({ request: null, checked: false, resolveIndex: null });
    resolveIndex(
      request.options.findIndex((option) => option.value === value),
      checked,
    );
  },
}));

function openChoice<T extends string>(
  request: ChoiceRequest<T> & { checkbox?: ChoiceCheckbox },
): Promise<CheckedChoice<T>> {
  if (useChoiceStore.getState().request) {
    console.warn(LOG_PREFIX, "a choice prompt is already open; cancelling the second one");
    toast.warning(request.busyMessage);
    return Promise.resolve({ answer: "cancel", checked: false });
  }
  return new Promise<CheckedChoice<T>>((resolve) => {
    useChoiceStore.setState({
      request,
      checked: false,
      resolveIndex: (index, checked) =>
        resolve({ answer: index === CANCELLED ? "cancel" : request.options[index].value, checked }),
    });
  });
}

async function askChoice<T extends string>(request: ChoiceRequest<T>): Promise<ChoiceAnswer<T>> {
  return (await openChoice(request)).answer;
}

function askChoiceWithCheckbox<T extends string>(request: CheckboxChoiceRequest<T>): Promise<CheckedChoice<T>> {
  return openChoice(request);
}

// -- Exports ------------------------------------------------------------------

export { askChoice, askChoiceWithCheckbox, useChoiceStore };
export type { ChoiceRequest };
