// -- Functions -----------------------------------------------------------------

// Covers the window so nothing under the pointer hovers or shows a cursor; returns the remover, safe to call twice.
function raisePointerShield(): () => void {
  const shield = document.createElement("div");
  shield.className = "fixed inset-0 cursor-none layer-floating";
  shield.dataset.pointerShield = "";
  document.body.append(shield);
  return () => shield.remove();
}

// -- Exports -------------------------------------------------------------------

export { raisePointerShield };
