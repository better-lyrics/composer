import { createAudioFile } from "@/test/audio-fixtures";

// -- Types --------------------------------------------------------------------

type DragEventType = "dragenter" | "dragleave" | "dragover" | "drop" | "dragend";

interface DragPayload {
  files?: File[];
  data?: Record<string, string>;
  relatedTarget?: Element | null;
}

// -- Constants ----------------------------------------------------------------

const DRAGGED_LINK = "https://youtu.be/dQw4w9WgXcQ";

// -- Helpers ------------------------------------------------------------------

function dispatchDrag(
  target: EventTarget,
  type: DragEventType,
  { files = [], data = {}, relatedTarget = null }: DragPayload = {},
): DragEvent {
  const dataTransfer = new DataTransfer();
  for (const file of files) dataTransfer.items.add(file);
  for (const [format, value] of Object.entries(data)) dataTransfer.setData(format, value);
  const event = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer, relatedTarget });
  target.dispatchEvent(event);
  return event;
}

function dragFile(target: EventTarget, type: DragEventType, file: File = createAudioFile()): DragEvent {
  return dispatchDrag(target, type, { files: [file] });
}

function dragText(target: EventTarget, type: DragEventType, text = DRAGGED_LINK): DragEvent {
  return dispatchDrag(target, type, { data: { "text/plain": text } });
}

// -- Exports ------------------------------------------------------------------

export { DRAGGED_LINK, dispatchDrag, dragFile, dragText };
