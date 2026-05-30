import { routes } from "@/router";
import { registerAllRomanizationGenerators } from "@/utils/romanization/bootstrap-generators";
import { ViteReactSSG } from "vite-react-ssg";
import "@/index.css";

registerAllRomanizationGenerators();

export const createRoot = ViteReactSSG({ routes });
