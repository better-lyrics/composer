import { useCallback, useLayoutEffect, useRef } from "react";
import { caretAfterTextChange, shiftCaretPastRewrittenRows } from "@/views/edit/edit-text";

interface PendingCaret {
  start: number;
  end: number;
}

function useEditTextCaret(rawText: string, setRawText: (text: string) => void) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaretRef = useRef<PendingCaret | null>(null);

  useLayoutEffect(() => {
    const pending = pendingCaretRef.current;
    const textarea = textareaRef.current;
    if (!pending || !textarea) return;
    pendingCaretRef.current = null;
    textarea.setSelectionRange(pending.start, pending.end);
  }, [rawText]);

  const showEditText = useCallback(
    (typedText: string, editText: string, textarea: HTMLTextAreaElement) => {
      if (editText !== typedText) {
        pendingCaretRef.current = {
          start: shiftCaretPastRewrittenRows(typedText, editText, textarea.selectionStart),
          end: shiftCaretPastRewrittenRows(typedText, editText, textarea.selectionEnd),
        };
      }
      setRawText(editText);
    },
    [setRawText],
  );

  const showChangedText = useCallback(
    (nextText: string) => {
      const textarea = textareaRef.current;
      if (textarea && textarea === document.activeElement && textarea.value !== nextText) {
        const caret = caretAfterTextChange(textarea.value, nextText);
        pendingCaretRef.current = { start: caret, end: caret };
      }
      setRawText(nextText);
    },
    [setRawText],
  );

  return { textareaRef, showEditText, showChangedText };
}

function useComposedTextareaChange(
  setRawText: (text: string) => void,
  applyTextareaText: (textarea: HTMLTextAreaElement) => void,
) {
  const composingRef = useRef(false);

  // Rewriting textarea.value mid-composition cancels the IME, so the text is applied once at compositionend.
  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (composingRef.current) setRawText(e.target.value);
      else applyTextareaText(e.target);
    },
    [setRawText, applyTextareaText],
  );

  const onCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);

  const onCompositionEnd = useCallback(
    (e: React.CompositionEvent<HTMLTextAreaElement>) => {
      composingRef.current = false;
      applyTextareaText(e.currentTarget);
    },
    [applyTextareaText],
  );

  return { onChange, onCompositionStart, onCompositionEnd };
}

export { useComposedTextareaChange, useEditTextCaret };
