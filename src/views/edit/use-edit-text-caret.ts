import { useCallback, useLayoutEffect, useRef } from "react";
import { shiftCaretPastRewrittenRows } from "insync/edit-text";
import { type ShownEditText, shownEditText } from "insync/edit-text-shown-row";
import type { LyricLine } from "insync/line";
import { changedRegion } from "@/domain/edit-text/background-ranges";
import { useProjectStore } from "@/stores/project";
import { scrollCaretIntoView } from "@/views/edit/textarea-caret-view";
import { getSplitCharacter } from "@/utils/split-character";

interface PendingCaret {
  typedText: string;
  start: number;
  end: number;
  scrollTop: number;
  // Lines written from outside the text, as undo does: the caret goes to the end of what changed.
  replaced?: true;
}

function useEditTextCaret(rawText: string, showText: (edit: ShownEditText) => void) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaretRef = useRef<PendingCaret | null>(null);
  const shownTextRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const pending = pendingCaretRef.current;
    const textarea = textareaRef.current;
    if (!pending || !textarea) return;
    pendingCaretRef.current = null;
    if (pending.replaced) {
      const at = changedRegion(pending.typedText, rawText).newEnd;
      textarea.scrollTop = pending.scrollTop;
      textarea.setSelectionRange(at, at);
      scrollCaretIntoView(textarea);
      return;
    }
    textarea.setSelectionRange(
      shiftCaretPastRewrittenRows(pending.typedText, rawText, pending.start),
      shiftCaretPastRewrittenRows(pending.typedText, rawText, pending.end),
    );
    // A new value moves the caret to the end and scrolls there; the typed row was in view, so the view stays.
    textarea.scrollTop = pending.scrollTop;
  }, [rawText]);

  const showEditText = useCallback(
    (typedText: string, edit: ShownEditText, textarea: HTMLTextAreaElement) => {
      if (edit.text !== typedText) {
        pendingCaretRef.current = {
          typedText,
          start: textarea.selectionStart,
          end: textarea.selectionEnd,
          scrollTop: textarea.scrollTop,
        };
      }
      shownTextRef.current = edit.text;
      showText(edit);
    },
    [showText],
  );

  const showLines = useCallback(
    (lines: readonly LyricLine[]) => {
      const edit = shownEditText(lines, getSplitCharacter());
      const textarea = textareaRef.current;
      if (textarea && document.activeElement === textarea && edit.text !== textarea.value) {
        pendingCaretRef.current = {
          typedText: textarea.value,
          start: 0,
          end: 0,
          scrollTop: textarea.scrollTop,
          replaced: true,
        };
      }
      showText(edit);
    },
    [showText],
  );

  return { textareaRef, showEditText, shownTextRef, showLines };
}

function useComposedTextareaChange(
  setRawText: (text: string, caret?: number) => void,
  applyTextareaText: (textarea: HTMLTextAreaElement) => void,
  shownTextRef: React.RefObject<string | null>,
) {
  const composingRef = useRef(false);
  const appliedAtEndRef = useRef<{ values: readonly string[]; lines: readonly LyricLine[] } | null>(null);

  // Rewriting textarea.value mid-composition cancels the IME, so the text is applied once at compositionend. Safari
  // can send the final input after compositionend; that input carries the value already applied, as typed or as shown.
  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const appliedAtEnd = appliedAtEndRef.current;
      appliedAtEndRef.current = null;
      if (composingRef.current) setRawText(e.target.value, e.target.selectionEnd);
      else if (
        !appliedAtEnd?.values.includes(e.target.value) ||
        appliedAtEnd.lines !== useProjectStore.getState().lines
      ) {
        applyTextareaText(e.target);
      }
    },
    [setRawText, applyTextareaText],
  );

  const onCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);

  const onCompositionEnd = useCallback(
    (e: React.CompositionEvent<HTMLTextAreaElement>) => {
      composingRef.current = false;
      const typed = e.currentTarget.value;
      shownTextRef.current = null;
      applyTextareaText(e.currentTarget);
      const shown = shownTextRef.current ?? typed;
      appliedAtEndRef.current = { values: [typed, shown], lines: useProjectStore.getState().lines };
    },
    [applyTextareaText, shownTextRef],
  );

  return { onChange, onCompositionStart, onCompositionEnd };
}

export { useComposedTextareaChange, useEditTextCaret };
