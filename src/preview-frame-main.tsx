import { isAllowedParentOrigin, parentOriginOf } from "@/views/preview/frame/preview-frame-protocol";
import { PreviewFrameApp } from "@/views/preview/frame/preview-frame-app";
import { LazyMotion, domAnimation } from "motion/react";
import { createRoot } from "react-dom/client";
import "@/index.css";

const LOG_PREFIX = "[PreviewFrame]";

const parentOrigin = parentOriginOf(window.location.href);
const root = document.getElementById("root");

if (!parentOrigin || !isAllowedParentOrigin(window.location.origin, parentOrigin)) {
  console.warn(LOG_PREFIX, "not embedded by an allowed origin", parentOrigin);
} else if (root) {
  createRoot(root).render(
    <LazyMotion features={domAnimation} strict>
      <PreviewFrameApp parentOrigin={parentOrigin} />
    </LazyMotion>,
  );
}
