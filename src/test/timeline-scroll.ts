// -- Functions -----------------------------------------------------------------

// Scrolls a track's host element in the DOM only, like an assignment to the scroll container before its scroll event fires.
function scrollTrackHost(track: Element, scrollLeft: number): void {
  const host = track.parentElement;
  if (!host) throw new Error("track has no host element to scroll");
  host.style.overflowX = "scroll";
  host.style.width = "200px";
  host.scrollLeft = scrollLeft;
}

// -- Exports -------------------------------------------------------------------

export { scrollTrackHost };
