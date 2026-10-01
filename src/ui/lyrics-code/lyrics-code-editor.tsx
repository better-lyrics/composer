import { cn } from "@/utils/cn";
import { type EditorHandle, type EditorOptions, type LyricFormat, attachEditor, layerText } from "@braccato/highlight";
import { useCallback, useLayoutEffect, useRef } from "react";

// -- Interfaces ---------------------------------------------------------------

interface LyricsCodeEditorProps extends Omit<React.ComponentProps<"textarea">, "value"> {
  value: string;
  format?: LyricFormat;
  frameClassName?: string;
}

// -- Helpers ------------------------------------------------------------------

// Attaching and destroying move the textarea in the DOM, which drops focus.
function keepingFocus<T>(textarea: HTMLTextAreaElement, move: () => T): T {
  const hadFocus = textarea.ownerDocument.activeElement === textarea;
  const result = move();
  if (hadFocus) textarea.focus({ preventScroll: true });
  return result;
}

function refreshIfStale(editor: EditorHandle, value: string): void {
  if (editor.layer.textContent !== layerText(value)) editor.refresh();
}

// -- Components ---------------------------------------------------------------

// The frame only ever holds the textarea, so attachEditor can move it into its wrapper without React noticing.
const LyricsCodeEditor: React.FC<LyricsCodeEditorProps> = ({
  value,
  format,
  frameClassName,
  className,
  ...textareaProps
}) => {
  const editorRef = useRef<EditorHandle | null>(null);
  // attachEditor reads format from this object on every render, so a new format applies without moving the textarea.
  const editorOptions = useRef<EditorOptions>({ format });

  const attachToFrame = useCallback((frame: HTMLDivElement) => {
    const textarea = frame.querySelector("textarea");
    if (!textarea) return;
    const editor = keepingFocus(textarea, () => attachEditor(textarea, editorOptions.current));
    editorRef.current = editor;
    // React restores a rejected controlled value in its root listener without a commit, so check once input has bubbled past it.
    const resyncAfterInput = (event: Event) => {
      if (event.target === textarea) refreshIfStale(editor, textarea.value);
    };
    const ownerDocument = textarea.ownerDocument;
    // react-doctor-disable-next-line react-doctor/effect-needs-cleanup -- removed in this ref callback's cleanup
    ownerDocument.addEventListener("input", resyncAfterInput);
    return () => {
      ownerDocument.removeEventListener("input", resyncAfterInput);
      keepingFocus(textarea, editor.destroy);
      editorRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (editorOptions.current.format === format) return;
    editorOptions.current.format = format;
    editorRef.current?.refresh();
  }, [format]);

  useLayoutEffect(() => {
    if (editorRef.current) refreshIfStale(editorRef.current, value);
  }, [value]);

  return (
    <div ref={attachToFrame} className={cn("lyrics-code-frame", frameClassName)}>
      <textarea value={value} className={cn(className, "bh-input")} {...textareaProps} />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { LyricsCodeEditor };
