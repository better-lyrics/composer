import { useBeatDetectionStore } from "@/stores/beat-detection";
import { IconHandFinger } from "@tabler/icons-react";
import { PopActions, PopButton, PopHead } from "@/views/timeline/beat-grid/beat-grid-layout";

// -- Components ----------------------------------------------------------------

const BeatGridFailed: React.FC<{ onSetByHand: () => void; onBack?: () => void }> = ({ onSetByHand, onBack }) => {
  const error = useBeatDetectionStore((s) => s.error);
  return (
    <>
      <PopHead title="Couldn't detect beats" onBack={onBack} />
      <div className="mx-1 mt-2 px-2.5 py-2 rounded-lg font-mono text-[11.5px] leading-normal text-(--label) wrap-break-word bg-[color-mix(in_oklab,var(--color-composer-error)_12%,transparent)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-composer-error)_30%,transparent)] select-text cursor-text">
        {error}
      </div>
      <PopActions split className="mt-4">
        <PopButton variant="ghost" icon={IconHandFinger} onClick={onSetByHand}>
          Set by hand
        </PopButton>
        <span className="flex gap-1.5">
          <PopButton onClick={() => useBeatDetectionStore.getState().dismiss()}>Dismiss</PopButton>
          <PopButton variant="primary" onClick={() => void useBeatDetectionStore.getState().run()}>
            Try again
          </PopButton>
        </span>
      </PopActions>
    </>
  );
};

// -- Exports -------------------------------------------------------------------

export { BeatGridFailed };
