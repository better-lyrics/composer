import { routes } from "@/router";
import { ViteReactSSG } from "vite-react-ssg";
import "@/index.css";

export const createRoot = ViteReactSSG({ routes });
