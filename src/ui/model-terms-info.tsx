import type { ModelTerms } from "@/audio/alignment/hubertfa/model-manifest";
import { IconButton } from "@/ui/icon-button";
import { KEEPS_POPOVERS_OPEN_PROPS } from "@/ui/keeps-popovers-open";
import { Popover } from "@/ui/popover";
import { Tooltip } from "@/ui/tooltip";
import { IconInfoCircle } from "@tabler/icons-react";

// -- Components ----------------------------------------------------------------

// Next to the selected model: opens on click, so the license link can be
// followed. Marked so opening it inside the auto-align popover keeps that open.
const ModelTermsInfo: React.FC<{ terms: ModelTerms }> = ({ terms }) => (
  <Popover
    placement="bottom-end"
    trigger={
      <IconButton
        label="Model license"
        icon={<IconInfoCircle className="size-[15px]" />}
        variant="ghost"
        className="size-7 rounded-lg"
      />
    }
  >
    <div
      {...KEEPS_POPOVERS_OPEN_PROPS}
      className="flex w-72 flex-col gap-2 p-3.5 text-[12.5px] leading-[1.55] text-(--label) select-text"
    >
      <p className="text-pretty">{terms.notice}</p>
      <a
        href={terms.url}
        target="_blank"
        rel="noreferrer"
        className="self-start text-composer-accent-text hover:text-composer-accent underline-offset-2 hover:underline"
      >
        View license
      </a>
    </div>
  </Popover>
);

// Inside a picker option, which is itself a button, so it can only be hovered.
const ModelTermsHint: React.FC<{ terms: ModelTerms }> = ({ terms }) => (
  <Tooltip content={terms.notice}>
    <IconInfoCircle role="img" aria-label={terms.notice} className="size-3.5 shrink-0 text-(--muted)" />
  </Tooltip>
);

// -- Exports -------------------------------------------------------------------

export { ModelTermsHint, ModelTermsInfo };
