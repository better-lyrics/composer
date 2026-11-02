import { Button } from "@/ui/button";
import { cn } from "@/utils/cn";

// -- Types ---------------------------------------------------------------------

interface SkeletonRowsProps {
  count: number;
  rowClassName: string;
  children: React.ReactNode;
}

interface InlineErrorProps {
  error: Error;
  onRetry: () => void;
}

interface LoadMoreProps {
  label: string;
  loading: boolean;
  onLoadMore: () => void;
}

// -- Constants -----------------------------------------------------------------

const SKELETON_BLOCK = "block rounded bg-(--layer-2)";

// -- Components ----------------------------------------------------------------

const SkeletonRows: React.FC<SkeletonRowsProps> = ({ count, rowClassName, children }) => (
  <ul aria-hidden="true" className="flex flex-col animate-pulse motion-reduce:animate-none">
    {Array.from({ length: count }, (_, index) => (
      <li key={index} className={rowClassName}>
        {children}
      </li>
    ))}
  </ul>
);

const SkeletonSong: React.FC = () => (
  <>
    <span className={cn(SKELETON_BLOCK, "size-10 rounded-md")} />
    <span className="flex flex-col gap-1.5 min-w-0">
      <span className={cn(SKELETON_BLOCK, "h-3 w-2/5")} />
      <span className={cn(SKELETON_BLOCK, "h-2.5 w-1/4")} />
    </span>
  </>
);

const SkeletonBar: React.FC<{ className?: string }> = ({ className }) => (
  <span className={cn(SKELETON_BLOCK, "h-2.5", className)} />
);

const InlineError: React.FC<InlineErrorProps> = ({ error, onRetry }) => (
  <div role="alert" className="flex items-center gap-3 px-3 py-4">
    <p className="text-sm text-composer-text-secondary select-text cursor-text">{error.message}</p>
    <Button size="sm" variant="secondary" onClick={onRetry}>
      Retry
    </Button>
  </div>
);

const ViewEmpty: React.FC<{ message: string; children?: React.ReactNode }> = ({ message, children }) => (
  <div className="flex flex-col items-start gap-3 px-3 py-4">
    <p className="text-sm text-composer-text-secondary">{message}</p>
    {children}
  </div>
);

const LoadMore: React.FC<LoadMoreProps> = ({ label, loading, onLoadMore }) => (
  <div className="flex justify-center pt-3">
    <Button size="md" variant="secondary" disabled={loading} onClick={onLoadMore}>
      {loading ? "Loading" : label}
    </Button>
  </div>
);

// -- Exports -------------------------------------------------------------------

export { InlineError, LoadMore, SkeletonBar, SkeletonRows, SkeletonSong, ViewEmpty };
