import type { BackgroundSeparator } from "insync/background-vocal-brackets";

const BACKGROUND_SEPARATOR_OPTIONS: readonly { value: BackgroundSeparator; label: string }[] = [
  { value: "space", label: "Space" },
  { value: "comma", label: "Comma" },
];

export { BACKGROUND_SEPARATOR_OPTIONS };
