// -- Functions ----------------------------------------------------------------

// Chrome adds the image file when a linked thumbnail is dragged, so a link that carries only images is a link drag.
function isFileDrag({ types, items }: DataTransfer): boolean {
  if (!types.includes("Files")) return false;
  if (!types.includes("text/uri-list")) return true;
  return Array.from(items).some((item) => item.kind === "file" && !item.type.startsWith("image/"));
}

// -- Exports ------------------------------------------------------------------

export { isFileDrag };
