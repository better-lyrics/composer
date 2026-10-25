import { Button } from "@/ui/button";

// -- Components ---------------------------------------------------------------

const ErrorState: React.FC<{ message: string; onRetry: () => void; onDismiss: () => void }> = ({
  message,
  onRetry,
  onDismiss,
}) => (
  <div className="mb-3.5">
    <p className="text-[13.5px] font-bold text-composer-text">Vocal separation failed</p>
    <p className="mt-1.5 text-[12.5px] leading-[1.45] text-(--muted) text-pretty wrap-break-word select-text">
      {message}
    </p>
    <div className="flex justify-end gap-2 mt-3.5">
      <Button size="sm" variant="ghost" onClick={onDismiss}>
        Dismiss
      </Button>
      <Button size="sm" variant="primary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  </div>
);

// -- Exports ------------------------------------------------------------------

export { ErrorState };
