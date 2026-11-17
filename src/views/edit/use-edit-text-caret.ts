import { caretThroughRedraw, shiftCaretPastRewrittenRows } from "insync/edit-text";
import { type ShownEditText, shownEditText } from "insync/edit-text-shown-row";
import type { LyricLine } from "insync/line";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { changedRegion } from "@/domain/edit-text/background-ranges";
import { cancelNextFrame, nextFrame } from "@/lib/frame-loop";
import { useProjectStore } from "@/stores/project";
import { getSplitCharacter } from "@/utils/split-character";
import { scrollCaretIntoView } from "@/views/edit/textarea-caret-view";

interface PendingCaret {
  typedText: string;
  start: number;
  end: number;
  scrollTop: number;
  // Lines written from outside the text, as undo does: the caret goes to the end of what changed, or stays by the same
  // letters when the new text only redraws the old one.
  replaced?: true;
  // A paste: the view goes back to where it was before the browser scrolled for the pasted text.
  pasted?: true;
}

function useEditTextCaret(rawText: string, showText: (edit: ShownEditText) => void) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaretRef = useRef<PendingCaret | null>(null);
  const [caretVersion, setCaretVersion] = useState(0);
  const shownTextRef = useRef<string | null>(null);
  const scrollBeforePasteRef = useRef<number | null>(null);

  // Read before the browser scrolls for the pasted text; a paste taken over as an import leaves nothing to restore.
  useEffect(() => {
    let forgetFrame: number | null = null;
    const notePaste = (event: ClipboardEvent) => {
      const textarea = textareaRef.current;
      if (!textarea || event.target !== textarea) return;
      scrollBeforePasteRef.current = textarea.scrollTop;
      // The paste's input comes before the next frame; a paste with no input (an empty clipboard) leaves nothing.
      if (forgetFrame !== null) cancelNextFrame(forgetFrame);
      forgetFrame = nextFrame(() => {
        forgetFrame = null;
        scrollBeforePasteRef.current = null;
      });
    };
    const dropTakenOver = (event: ClipboardEvent) => {
      if (event.defaultPrevented) scrollBeforePasteRef.current = null;
    };
    window.addEventListener("paste", notePaste, true);
    window.addEventListener("paste", dropTakenOver);
    return () => {
      if (forgetFrame !== null) cancelNextFrame(forgetFrame);
      window.removeEventListener("paste", notePaste, true);
      window.removeEventListener("paste", dropTakenOver);
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: each pending caret renders once, so it is placed even when the text shown is the text that was there before
  useLayoutEffect(() => {
    const pending = pendingCaretRef.current;
    const textarea = textareaRef.current;
    if (!pending || !textarea) return;
    pendingCaretRef.current = null;
    const splitChar = getSplitCharacter();
    if (pending.replaced) {
      const mapped = (caret: number) =>
        caretThroughRedraw(pending.typedText, rawText, caret, splitChar) ??
        changedRegion(pending.typedText, rawText).newEnd;
      textarea.scrollTop = pending.scrollTop;
      textarea.setSelectionRange(mapped(pending.start), mapped(pending.end));
      scrollCaretIntoView(textarea);
      return;
    }
    textarea.setSelectionRange(
      shiftCaretPastRewrittenRows(pending.typedText, rawText, pending.start, splitChar),
      shiftCaretPastRewrittenRows(pending.typedText, rawText, pending.end, splitChar),
    );
    // A new value moves the caret to the end and scrolls there; the typed row was in view, so the view stays.
    textarea.scrollTop = pending.scrollTop;
    if (pending.pasted) scrollCaretIntoView(textarea);
  }, [rawText, caretVersion]);

  const showEditText = useCallback(
    (typedText: string, edit: ShownEditText, textarea: HTMLTextAreaElement) => {
      const scrollBeforePaste = scrollBeforePasteRef.current;
      scrollBeforePasteRef.current = null;
      if (edit.text !== typedText || scrollBeforePaste !== null) {
        setCaretVersion((version) => version + 1);
        pendingCaretRef.current = {
          typedText,
          start: textarea.selectionStart,
          end: textarea.selectionEnd,
          scrollTop: scrollBeforePaste ?? textarea.scrollTop,
          ...(scrollBeforePaste !== null && { pasted: true }),
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
        setCaretVersion((version) => version + 1);
        pendingCaretRef.current = {
          typedText: textarea.value,
          start: textarea.selectionStart,
          end: textarea.selectionEnd,
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
