import { useExportTtml } from "@/hooks/use-export-ttml";
import { PREVIEW_SIDEBAR_WIDTH } from "@/utils/preview-sidebar-width";
import { LyricsRenderer } from "@/views/preview/lyrics-renderer";
import { usePreviewSidebarResize } from "@/views/timeline/use-preview-sidebar-resize";
import { useId } from "react";

// -- Interfaces ---------------------------------------------------------------

interface PreviewSidebarShellProps {
  children: React.ReactNode;
}

// -- Components ---------------------------------------------------------------

const PreviewSidebarShell: React.FC<PreviewSidebarShellProps> = ({ children }) => {
  const { width, onPointerDown, onDoubleClick, onKeyDown } = usePreviewSidebarResize();
  const sidebarId = useId();

  return (
    <aside
      id={sidebarId}
      aria-label="Lyrics preview"
      style={{ width }}
      className="relative shrink-0 border-l border-composer-border bg-composer-bg-dark flex flex-col overflow-hidden"
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
      <div className="px-3 py-2 border-b border-composer-border text-xs font-medium text-composer-text-muted select-none">
        Preview
      </div>
      {children}
    </aside>
  );
};

const TimelinePreviewSidebar: React.FC = () => {
  const { content, duration, syncedLineCount } = useExportTtml();

  return (
    <PreviewSidebarShell>
      {syncedLineCount === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <span className="text-sm text-composer-text-muted">No synced content</span>
        </div>
      ) : (
        <LyricsRenderer ttmlString={content} durationSeconds={duration} layout="sidebar" />
      )}
    </PreviewSidebarShell>
  );
};

// -- Exports ------------------------------------------------------------------

export { TimelinePreviewSidebar };
