import type { ModelFile } from "@/domain/models/model-files";
import { IconButton } from "@/ui/icon-button";
import { cn } from "@/utils/cn";
import { formatFileSize } from "@/utils/format-file-size";
import { pluralize } from "@/utils/pluralize";
import { type Icon, IconTrash } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface ModelFileRowProps {
  icon: Icon;
  label: string;
  files: readonly ModelFile[];
  totalBytes: number;
  busy: boolean;
  onRemove: () => void;
}

// -- Constants ----------------------------------------------------------------

const BUSY_TITLE = "Finish the current run to remove it";
const ROW_GRID = "grid grid-cols-[28px_minmax(0,1fr)_72px_28px] items-center gap-3 px-2";

// -- Helpers ------------------------------------------------------------------

function fileNameOf(url: string): string {
  return new URL(url).pathname.split("/").at(-1) ?? url;
}

// -- Components ---------------------------------------------------------------

const ModelFileDetail: React.FC<{ file: ModelFile }> = ({ file }) => (
  <li className={cn(ROW_GRID, "h-7")}>
    <span />
    <span className="truncate text-xs text-composer-text-secondary select-text">{fileNameOf(file.url)}</span>
    <span className="text-right text-xs tabular-nums text-composer-text-muted select-text">
      {formatFileSize(file.bytes)}
    </span>
    <span />
  </li>
);

const ModelFileRow: React.FC<ModelFileRowProps> = ({ icon: ModelIcon, label, files, totalBytes, busy, onRemove }) => {
  const name = files.length === 1 ? fileNameOf(files[0].url) : pluralize(files.length, "file");
  return (
    <ul className="-mx-2 m-0 list-none p-0">
      <li className={cn("group h-11 rounded-lg hover:bg-(--layer-1)", ROW_GRID)}>
        <span className="grid size-7 place-items-center rounded-md bg-(--layer-2) text-composer-text">
          <ModelIcon aria-hidden="true" className="size-4 opacity-70" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-composer-text select-text">{name}</span>
          <span className="block truncate text-xs text-composer-text-muted select-none">
            {busy ? `In use. ${BUSY_TITLE}` : "Downloaded"}
          </span>
        </span>
        <span className="text-right text-[13px] tabular-nums text-composer-text-secondary select-text">
          {formatFileSize(totalBytes)}
        </span>
        <IconButton
          label={busy ? `${label} are in use` : `Remove ${label.toLowerCase()}`}
          icon={<IconTrash aria-hidden="true" className="size-4" />}
          variant="ghost"
          aria-disabled={busy ? "true" : undefined}
          onClick={busy ? undefined : onRemove}
          className={cn(
            "size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            busy && "cursor-not-allowed group-hover:opacity-35 hover:bg-transparent hover:text-composer-text-muted",
          )}
          {...(busy ? { title: BUSY_TITLE } : {})}
        />
      </li>
      {files.length > 1 && files.map((file) => <ModelFileDetail key={file.url} file={file} />)}
    </ul>
  );
};

// -- Exports ------------------------------------------------------------------

export { ModelFileRow };
