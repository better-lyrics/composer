// -- Functions ----------------------------------------------------------------

function fileNameWithoutExtension(name: string): string {
  return name.replace(/\.[^/.]+$/, "");
}

// -- Exports ------------------------------------------------------------------

export { fileNameWithoutExtension };
