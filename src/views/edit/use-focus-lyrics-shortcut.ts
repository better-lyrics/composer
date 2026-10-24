import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import type { RefObject } from "react";

function focusAtEnd(textarea: HTMLTextAreaElement | null): void {
  if (!textarea) return;
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}

function useFocusLyricsShortcut(textareaRef: RefObject<HTMLTextAreaElement | null>, enabled: boolean): void {
  useKeyboardShortcuts({ "global.goToEdit": () => focusAtEnd(textareaRef.current) }, { enabled });
}

export { useFocusLyricsShortcut };
