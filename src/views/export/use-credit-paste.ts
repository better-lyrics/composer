import { type CreditKind, splitCreditList } from "@/domain/project/credit-list";
import { historyShortcutAction } from "@/utils/history-shortcut";
import type { Row } from "@/views/export/metadata-field-rows";
import { nanoid } from "nanoid";
import { useRef } from "react";
import { flushSync } from "react-dom";

// -- Interfaces ---------------------------------------------------------------

interface PendingSplit {
  rowId: string;
  before: Row[];
  text: string;
  caret: number;
}

interface CreditPaste {
  onPaste: (id: string, event: React.ClipboardEvent<HTMLInputElement>) => void;
  onKeyDown: (id: string, event: React.KeyboardEvent<HTMLInputElement>) => void;
  forget: () => void;
}

// -- Hook ---------------------------------------------------------------------

// A pasted "A, B, and C" becomes one row per name. Undo straight after keeps the paste as
// typed instead, the way undo reverts an autocorrect: the field's own undo has nothing to revert.
function useCreditPaste(rows: Row[], commit: (next: Row[]) => void, kind: CreditKind): CreditPaste {
  const pending = useRef<PendingSplit | null>(null);

  const forget = () => {
    pending.current = null;
  };

  const onPaste = (id: string, event: React.ClipboardEvent<HTMLInputElement>) => {
    forget();
    const input = event.currentTarget;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const pasted = event.clipboardData.getData("text");
    const text = input.value.slice(0, start) + pasted + input.value.slice(end);
    const names = splitCreditList(text, kind);
    if (names.length < 2) return;
    event.preventDefault();
    pending.current = { rowId: id, before: rows, text, caret: start + pasted.length };
    commit(
      rows.flatMap((row) =>
        row.id === id ? names.map((value, index) => ({ id: index === 0 ? id : nanoid(), value })) : [row],
      ),
    );
  };

  const onKeyDown = (id: string, event: React.KeyboardEvent<HTMLInputElement>) => {
    const split = pending.current;
    if (split?.rowId !== id || historyShortcutAction(event.nativeEvent) !== "undo") return;
    event.preventDefault();
    forget();
    const input = event.currentTarget;
    flushSync(() => commit(split.before.map((row) => (row.id === id ? { ...row, value: split.text } : row))));
    input.setSelectionRange(split.caret, split.caret);
  };

  return { onPaste, onKeyDown, forget };
}

// -- Exports ------------------------------------------------------------------

export { useCreditPaste };
