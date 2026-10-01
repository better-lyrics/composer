import { cn } from "@/utils/cn";
import { type EditorHandle, type LyricFormat, attachEditor, layerText } from "@braccato/highlight";
import { useCallback, useLayoutEffect, useRef } from "react";

// -- Interfaces ---------------------------------------------------------------

interface LyricsCodeEditorProps extends Omit<React.ComponentProps<"textarea">, "value"> {
  value: string;
  format?: LyricFormat;
  frameClassName?: string;
}

// -- Components ---------------------------------------------------------------

// The frame only ever holds the textarea, so attachEditor can move it into its wrapper without React noticing.
const LyricsCodeEditor: React.FC<LyricsCodeEditorProps> = ({ value, format, frameClassName, ...textareaProps }) => {
  const editorRef = useRef<EditorHandle | null>(null);

  const attachToFrame = useCallback(
    (frame: HTMLDivElement) => {
      const textarea = frame.querySelector("textarea");
      if (!textarea) return;
      const editor = attachEditor(textarea, { format });
      editorRef.current = editor;
      return () => {
        editor.destroy();
        editorRef.current = null;
      };
    },
    [format],
  );

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.layer.textContent !== layerText(value)) editor.refresh();
  }, [value]);

  return (
    <div ref={attachToFrame} className={cn("lyrics-code-frame", frameClassName)}>
      <textarea value={value} {...textareaProps} />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { LyricsCodeEditor };
