import { routes } from "@/router";
import { initTheme } from "@/stores/theme";
import { ViteReactSSG } from "vite-react-ssg";
import "@/index.css";

if (typeof document !== "undefined") initTheme();

export const createRoot = ViteReactSSG({ routes });
