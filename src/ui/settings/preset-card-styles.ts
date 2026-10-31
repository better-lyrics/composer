// -- Constants -----------------------------------------------------------------

const CARD_BASE =
  "relative flex flex-col items-start text-left rounded-xl px-2.5 pt-2.5 pb-3 cursor-pointer transition-[background-color,box-shadow] select-none";

const CARD_INACTIVE = "bg-(--layer-1) shadow-[inset_0_0_0_1px_var(--edge)] hover:bg-(--layer-2)";

const CARD_ACTIVE =
  "bg-[color-mix(in_oklab,var(--color-composer-accent)_10%,var(--layer-1))] shadow-[inset_0_0_0_1.5px_var(--color-composer-accent),0_0_0_3px_var(--lit-ring)]";

const CARD_GROUP_LABEL = "text-xs font-semibold text-(--muted) select-none";

const HEADER_ACTION_BUTTON = "h-6 pl-1.5 pr-2 text-xs rounded-md";

// -- Exports -------------------------------------------------------------------

export { CARD_ACTIVE, CARD_BASE, CARD_GROUP_LABEL, CARD_INACTIVE, HEADER_ACTION_BUTTON };
