import { useBeatDetectionStore } from "@/stores/beat-detection";
import { PopActions, PopButton, PopHead, PopText, SetByHandButton } from "@/ui/pop-layout";

// -- Components ----------------------------------------------------------------

const BeatGridFailed: React.FC<{ onSetByHand: () => void; onBack?: () => void }> = ({ onSetByHand, onBack }) => {
  const error = useBeatDetectionStore((s) => s.error);
  const detail = useBeatDetectionStore((s) => s.errorDetail);
  return (
    <>
      <PopHead title="Couldn't detect beats" onBack={onBack} />
      <PopText className="mt-1 select-text cursor-text">{error}</PopText>
      {detail && (
        <div className="mx-1 mt-2 px-2.5 py-2 rounded-lg font-mono text-[11.5px] leading-normal text-(--label) wrap-break-word bg-[color-mix(in_oklab,var(--color-composer-error)_12%,transparent)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-composer-error)_30%,transparent)] select-text cursor-text">
          {detail}
        </div>
      )}
      <PopActions split className="mt-4">
        <SetByHandButton variant="ghost" onClick={onSetByHand} />
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
