import { definePresets } from "@/domain/theme/define-presets";

// -- Classic light presets -----------------------------------------------------
// Light presets pin accent-text: the derived shade is too pale on a light base.

const CLASSIC_LIGHT_PRESETS = definePresets("Classics", [
  {
    id: "catppuccin-latte",
    name: "Catppuccin Latte",
    scheme: "light",
    desc: "Catppuccin with milk.",
    tokens: {
      bg: "#f2f4f7",
      "bg-dark": "#e6e9ef",
      "bg-elevated": "#ffffff",
      text: "#4c4f69",
      "text-tertiary": "#6c6f85",
      "text-faint": "#9ca0b0",
      accent: "#8839ef",
      "accent-warm": "#fe640b",
      link: "#1e66f5",
      error: "#d20f39",
      "error-text": "#6e0820",
      warning: "#df8e1d",
      explicit: "#ea76cb",
      wave: "#bcc0cc",
      "accent-text": "#5f28a7",
    },
  },
  {
    id: "flexoki-light",
    name: "Flexoki Light",
    scheme: "light",
    desc: "Flexoki on the paper it was made for.",
    tokens: {
      bg: "#fffcf0",
      "bg-dark": "#f2f0e5",
      "bg-elevated": "#ffffff",
      text: "#100f0f",
      "text-tertiary": "#6f6e69",
      "text-faint": "#b7b5ac",
      accent: "#24837b",
      "accent-warm": "#bc5215",
      link: "#205ea6",
      error: "#af3029",
      "error-text": "#5e1915",
      warning: "#ad8301",
      explicit: "#a02f6f",
      wave: "#dad8ce",
      "accent-text": "#195c56",
    },
  },
  {
    id: "solarized-light",
    name: "Solarized Light",
    scheme: "light",
    desc: "Solarized on cream paper.",
    tokens: {
      bg: "#fdf6e3",
      "bg-dark": "#eee8d5",
      "bg-elevated": "#ffffff",
      text: "#073642",
      "text-tertiary": "#586e75",
      "text-faint": "#93a1a1",
      accent: "#268bd2",
      "accent-warm": "#cb4b16",
      link: "#2aa198",
      error: "#dc322f",
      "error-text": "#7a1f1c",
      warning: "#b58900",
      explicit: "#d33682",
      wave: "#cfcbb8",
    },
  },
]);

export { CLASSIC_LIGHT_PRESETS };
