// -- Functions ----------------------------------------------------------------

function fileNameWithoutExtension(name: string): string {
  return name.replace(/\.[^/.]+$/, "");
}

function fileExtensionLabel(name: string | undefined, fallback: string): string {
  const dot = name?.lastIndexOf(".") ?? -1;
  if (!name || dot <= 0 || dot === name.length - 1) return fallback;
  return name.slice(dot + 1).toUpperCase();
}

// -- Exports ------------------------------------------------------------------

export { fileNameWithoutExtension, fileExtensionLabel };
