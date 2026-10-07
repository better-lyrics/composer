import { Button } from "@/ui/button";

// Shared states for popovers that download a model and then run a long task
// (vocal separation, auto-align).

const ProgressBar: React.FC<{ pct: number }> = ({ pct }) => (
  <div className="h-1.5 w-full bg-composer-button rounded overflow-hidden">
    <div
      className="h-full bg-composer-accent transition-[width] duration-150"
      style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
    />
  </div>
);

const ProgressState: React.FC<{ title: string; detail: string; pct: number; onCancel: () => void }> = ({
  title,
  detail,
  pct,
  onCancel,
}) => (
  <div className="flex flex-col gap-2 min-w-60">
    <p className="text-sm font-medium text-composer-text">{title}</p>
    <p className="text-xs text-composer-text-muted tabular-nums">{detail}</p>
    <ProgressBar pct={pct} />
    <div className="flex justify-end pt-1">
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  </div>
);

const ErrorState: React.FC<{ title: string; message: string; onRetry: () => void; onDismiss: () => void }> = ({
  title,
  message,
  onRetry,
  onDismiss,
}) => (
  <div className="flex flex-col gap-2">
    <p className="text-sm font-medium text-composer-text">{title}</p>
    <p className="text-xs text-composer-text-muted break-words">{message}</p>
    <div className="flex gap-2 pt-1 justify-end">
      <Button size="sm" variant="ghost" onClick={onDismiss}>
        Dismiss
      </Button>
      <Button size="sm" variant="primary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  </div>
);

export { ErrorState, ProgressState };
