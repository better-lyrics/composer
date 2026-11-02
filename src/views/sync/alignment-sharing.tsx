import { setAlignmentSharing } from "@/lib/alignment-telemetry-consent";
import { useAlignmentTelemetryStore } from "@/stores/alignment-telemetry";
import { Checkbox } from "@/ui/checkbox";
import { IconButton } from "@/ui/icon-button";
import { KEEPS_POPOVERS_OPEN_PROPS } from "@/ui/keeps-popovers-open";
import { Popover } from "@/ui/popover";
import { IconInfoCircle } from "@tabler/icons-react";

// -- Components ----------------------------------------------------------------

// Opens on click inside the auto-align popover, marked so that stays open.
const SharingDetails: React.FC = () => (
  <Popover
    placement="bottom-end"
    trigger={
      <IconButton
        label="What's shared"
        icon={<IconInfoCircle className="size-[15px]" />}
        variant="ghost"
        className="size-7 rounded-lg"
      />
    }
  >
    <div
      {...KEEPS_POPOVERS_OPEN_PROPS}
      className="flex w-80 flex-col gap-2 p-3.5 text-[12.5px] leading-[1.55] text-(--label) select-text text-pretty"
    >
      <p>
        <b>Why:</b> only to train future alignment models and to benchmark how the current ones do. Nothing else.
      </p>
      <p>
        <b>What:</b> for each auto-aligned line, its text, the model and settings used, the timing Auto-align gave it,
        and the timing you exported. With it, the song's title, artists, language and YouTube video id, a SHA-256 hash
        of the exported lyrics, the Composer version, and a random id for this browser.
      </p>
      <p>
        <b>When:</b> only when you download or copy the TTML in Export. Until then it stays in this browser.
      </p>
      <p>
        <b>Never:</b> audio, your name, email or account.
      </p>
      <p>
        Unchecking deletes what this browser collected for every project, and asks the server to delete everything
        already sent from this browser.
      </p>
    </div>
  </Popover>
);

const AlignmentSharing: React.FC = () => {
  const enabled = useAlignmentTelemetryStore((s) => s.enabled);
  return (
    <div className="mt-3 flex items-center justify-between gap-2 pl-2.5">
      <Checkbox checked={enabled} onCheckedChange={(checked) => void setAlignmentSharing(checked)}>
        Share alignment data to help improve auto-align
      </Checkbox>
      <SharingDetails />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { AlignmentSharing };
