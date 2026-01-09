import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";

// -- Components ----------------------------------------------------------------

const EmptyState: React.FC<{ message: string; hint: string }> = ({ message, hint }) => (
  <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center">
    <p className="text-lg text-composer-text-secondary">{message}</p>
    <p className="text-sm text-composer-text-muted">{hint}</p>
  </div>
);

const TimelinePanel: React.FC = () => {
  const source = useAudioStore((s) => s.source);
  const lines = useProjectStore((s) => s.lines);

  if (!source) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState message="No audio loaded" hint="Import audio in the Import tab first" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState message="No lyrics to display" hint="Add lyrics in the Edit tab first" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-4">
      <EmptyState message="Timeline view coming soon" hint="Waterfall multi-track timeline in development" />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelinePanel };
