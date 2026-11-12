import { useExportTtml } from "@/hooks/use-export-ttml";
import { useSettingsStore } from "@/stores/settings";
import { PREVIEW_SIDEBAR_WIDTH } from "@/utils/preview-sidebar-width";
import { LyricsRenderer } from "@/views/preview/lyrics-renderer";
import { useFocusRange } from "@/views/timeline/use-focus-range";
import { usePreviewSidebarResize } from "@/views/timeline/use-preview-sidebar-resize";
import { memo, useId, useRef } from "react";

// -- Interfaces ---------------------------------------------------------------

interface PreviewSidebarShellProps {
  children: React.ReactNode;
}

interface PreviewSidebarContentProps {
  isOpen: boolean;
}

// -- Components ---------------------------------------------------------------

const PreviewSidebarShell: React.FC<PreviewSidebarShellProps> = ({ children }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const { width, contentWidth, onPointerDown, onDoubleClick, onKeyDown } = usePreviewSidebarResize(contentRef);
  const sidebarId = useId();

  return (
    <aside
      id={sidebarId}
      aria-label="Lyrics preview"
      style={{ width }}
      className="relative shrink-0 border-l border-(--divider) bg-composer-bg-dark flex flex-col overflow-hidden"
    >
      <div
        role="separator"
        aria-label="Resize preview"
        aria-controls={sidebarId}
        aria-orientation="vertical"
        aria-valuenow={width}
        aria-valuemin={PREVIEW_SIDEBAR_WIDTH.min}
        aria-valuemax={PREVIEW_SIDEBAR_WIDTH.max}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
        className="absolute inset-y-0 left-0 z-20 w-1.5 cursor-ew-resize select-none hover:bg-composer-border focus-visible:bg-composer-border"
      />
      <div
        ref={contentRef}
        style={contentWidth === null ? undefined : { width: contentWidth }}
        className="flex flex-col flex-1 min-h-0"
      >
        {children}
      </div>
    </aside>
  );
};

// Memoized on isOpen: while the sidebar is hidden, Timeline re-renders skip it and no TTML is generated.
const PreviewSidebarContent = memo<PreviewSidebarContentProps>(() => {
  const { content, duration, syncedLineCount } = useExportTtml();
  const focusRange = useFocusRange();

  return (
    <PreviewSidebarShell>
      {syncedLineCount === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <span className="text-sm text-composer-text-muted">No synced content</span>
        </div>
      ) : (
        <LyricsRenderer
          ttmlString={content}
          durationSeconds={duration}
          layout="sidebar"
          focusRange={focusRange}
          isolated
        />
      )}
    </PreviewSidebarShell>
  );
});

const TimelinePreviewSidebar: React.FC = () => {
  const isOpen = useSettingsStore((s) => s.previewSidebar);
  return <PreviewSidebarContent isOpen={isOpen} />;
};

// -- Exports ------------------------------------------------------------------

export { TimelinePreviewSidebar };
