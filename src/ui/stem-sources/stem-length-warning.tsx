import { useSeparationStore } from "@/stores/separation";
import { Button } from "@/ui/button";
import { COMPACT_BUTTON } from "@/ui/stem-sources/compact-button";
import { StemNotice } from "@/ui/stem-sources/stem-notice";

// -- Component ----------------------------------------------------------------

const StemLengthWarning: React.FC<{ fileName: string; mismatchSeconds: number }> = ({ fileName, mismatchSeconds }) => {
  const longer = mismatchSeconds > 0;
  const { acceptPendingImport, cancelPendingImport } = useSeparationStore.getState();
  return (
    <StemNotice
      tone="warning"
      className="mt-0.5 mb-1.5"
      actions={
        <>
          <Button size="sm" variant="secondary" className={COMPACT_BUTTON} onClick={cancelPendingImport}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" className={COMPACT_BUTTON} onClick={() => void acceptPendingImport()}>
            Import anyway
          </Button>
        </>
      }
    >
      <p className="text-[12.5px] leading-[1.45] text-(--label) text-pretty">
        <span className="text-composer-text wrap-anywhere select-text">{fileName}</span> is{" "}
        {Math.abs(mismatchSeconds).toFixed(1)} s {longer ? "longer" : "shorter"} than the song. Words synced to this
        stem may {longer ? "land late" : "land early"}.
      </p>
    </StemNotice>
  );
};

// -- Exports ------------------------------------------------------------------

export { StemLengthWarning };
