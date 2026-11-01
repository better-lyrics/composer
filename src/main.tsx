import { redirectBootEntry } from "@/lib/boot-entry";
import { routes } from "@/router";
import { initTheme } from "@/stores/theme";
import { ViteReactSSG } from "vite-react-ssg";
import "@/index.css";

if (typeof document !== "undefined") {
  redirectBootEntry();
  initTheme();
}

export const createRoot = ViteReactSSG({ routes });
