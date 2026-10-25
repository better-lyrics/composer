import { useSeparationStore } from "@/stores/separation";
import { Button } from "@/ui/button";
import { COMPACT_BUTTON } from "@/ui/stem-sources/compact-button";
import { IconAlertTriangle } from "@tabler/icons-react";

// -- Component ----------------------------------------------------------------

const StemLengthWarning: React.FC<{ fileName: string; mismatchSeconds: number }> = ({ fileName, mismatchSeconds }) => {
  const longer = mismatchSeconds > 0;
  const { acceptPendingImport, cancelPendingImport } = useSeparationStore.getState();
  return (
    <div role="alert" className="relative mt-0.5 mb-1.5 p-2.5 pl-8.5 rounded-md bg-composer-warning/9">
      <IconAlertTriangle aria-hidden="true" className="absolute left-2.5 top-2.5 size-4 text-composer-warning" />
      <p className="text-[12.5px] leading-[1.45] text-(--label) text-pretty">
        <span className="text-composer-text wrap-anywhere select-text">{fileName}</span> is{" "}
        {Math.abs(mismatchSeconds).toFixed(1)} s {longer ? "longer" : "shorter"} than the song. Words synced to this
        stem may {longer ? "land late" : "land early"}.
      </p>
      <div className="flex justify-end gap-1.5 mt-2.5">
        <Button size="sm" variant="secondary" className={COMPACT_BUTTON} onClick={cancelPendingImport}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" className={COMPACT_BUTTON} onClick={() => void acceptPendingImport()}>
          Import anyway
        </Button>
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { StemLengthWarning };
