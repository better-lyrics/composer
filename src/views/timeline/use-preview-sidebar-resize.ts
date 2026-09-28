import { useSettingsStore } from "@/stores/settings";
import { PREVIEW_SIDEBAR_WIDTH, clampPreviewSidebarWidth } from "@/utils/preview-sidebar-width";
import { useCallback, useEffect, useRef, useState } from "react";

// -- Constants -----------------------------------------------------------------

const KEYBOARD_STEP_PX = 16;

// -- Helpers ------------------------------------------------------------------

function keyboardWidth(key: string, width: number): number | null {
  switch (key) {
    case "ArrowLeft":
      return width + KEYBOARD_STEP_PX;
    case "ArrowRight":
      return width - KEYBOARD_STEP_PX;
    case "Home":
      return PREVIEW_SIDEBAR_WIDTH.min;
    case "End":
      return PREVIEW_SIDEBAR_WIDTH.max;
    default:
      return null;
  }
}

// -- Hook ---------------------------------------------------------------------

function usePreviewSidebarResize() {
  const storedWidth = useSettingsStore((s) => s.previewSidebarWidth);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const width = dragWidth ?? clampPreviewSidebarWidth(storedWidth);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  const persistWidth = useCallback((px: number) => {
    useSettingsStore.getState().set("previewSidebarWidth", clampPreviewSidebarWidth(px));
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      cleanupRef.current?.();
      const startX = e.clientX;
      const startWidth = width;
      const widthAt = (clientX: number) => clampPreviewSidebarWidth(startWidth - (clientX - startX));

      const handlePointerMove = (moveEvent: PointerEvent) => setDragWidth(widthAt(moveEvent.clientX));
      const handlePointerUp = (upEvent: PointerEvent) => {
        cleanupRef.current?.();
        persistWidth(widthAt(upEvent.clientX));
      };
      const handlePointerCancel = () => cleanupRef.current?.();

      cleanupRef.current = () => {
        cleanupRef.current = null;
        setDragWidth(null);
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
        document.removeEventListener("pointercancel", handlePointerCancel);
      };
      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
      document.addEventListener("pointercancel", handlePointerCancel);
    },
    [width, persistWidth],
  );

  const onDoubleClick = useCallback(() => persistWidth(PREVIEW_SIDEBAR_WIDTH.default), [persistWidth]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const next = keyboardWidth(e.key, width);
      if (next === null) return;
      e.preventDefault();
      e.stopPropagation();
      persistWidth(next);
    },
    [width, persistWidth],
  );

  return { width, onPointerDown, onDoubleClick, onKeyDown };
}

// -- Exports ------------------------------------------------------------------

export { usePreviewSidebarResize };
