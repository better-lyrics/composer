import { IconArrowRight } from "@tabler/icons-react";
import { bindingToKeys } from "@/stores/shortcut-bindings";
import type { ShortcutChange } from "@/stores/shortcut-preset-changes";
import type { ShortcutBinding } from "@/stores/shortcut-registry";
import { KeyBadge } from "@/ui/shortcut-reference";
import { cn } from "@/utils/cn";

// -- Components ----------------------------------------------------------------

const BindingKeys: React.FC<{ binding: ShortcutBinding; muted?: boolean }> = ({ binding, muted = false }) => {
  const keys = bindingToKeys(binding);
  return (
    <span className={cn("flex items-center gap-0.5", muted && "opacity-55")}>
      {keys.length === 0 && <span className="text-[11.5px] text-(--muted)">No key</span>}
      {keys.map((key) => (
        <KeyBadge key={key} keyName={key} />
      ))}
    </span>
  );
};

const ShortcutChangeRows: React.FC<{ changes: readonly ShortcutChange[] }> = ({ changes }) => (
  <ul className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 px-2.5">
    {changes.map((change) => (
      <li key={change.id} className="col-span-4 grid grid-cols-subgrid items-center min-h-8">
        <span className="text-[12.5px] text-(--label)">{change.description}</span>
        <span className="justify-self-end">
          <BindingKeys binding={change.from} muted />
        </span>
        <IconArrowRight aria-label="becomes" className="size-3 text-composer-text opacity-25" />
        <BindingKeys binding={change.to} />
      </li>
    ))}
  </ul>
);

// -- Exports -------------------------------------------------------------------

export { ShortcutChangeRows };
