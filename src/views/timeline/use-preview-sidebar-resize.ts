import { useSettingsStore } from "@/stores/settings";
import { PREVIEW_SIDEBAR_WIDTH, clampPreviewSidebarWidth } from "@/utils/preview-sidebar-width";
import { useCallback, useEffect, useRef, useState } from "react";

// -- Constants -----------------------------------------------------------------

const KEYBOARD_STEP_PX = 16;

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
      const startX = e.clientX;
      const startWidth = width;
      const widthAt = (clientX: number) => clampPreviewSidebarWidth(startWidth - (clientX - startX));

      const handlePointerMove = (moveEvent: PointerEvent) => setDragWidth(widthAt(moveEvent.clientX));
      const handlePointerUp = (upEvent: PointerEvent) => {
        cleanupRef.current?.();
        persistWidth(widthAt(upEvent.clientX));
        setDragWidth(null);
      };

      cleanupRef.current = () => {
        cleanupRef.current = null;
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
      };
      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
    },
    [width, persistWidth],
  );

  const onDoubleClick = useCallback(() => persistWidth(PREVIEW_SIDEBAR_WIDTH.default), [persistWidth]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      e.stopPropagation();
      persistWidth(width + (e.key === "ArrowLeft" ? KEYBOARD_STEP_PX : -KEYBOARD_STEP_PX));
    },
    [width, persistWidth],
  );

  return { width, onPointerDown, onDoubleClick, onKeyDown };
}

// -- Exports ------------------------------------------------------------------

export { usePreviewSidebarResize };
