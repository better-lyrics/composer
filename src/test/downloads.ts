// -- Types --------------------------------------------------------------------

interface DownloadCapture {
  anchors: () => HTMLAnchorElement[];
  names: () => string[];
  stop: () => void;
}

// -- Capture ------------------------------------------------------------------

function captureDownloads(): DownloadCapture {
  const added: HTMLAnchorElement[] = [];
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) if (node instanceof HTMLAnchorElement && node.download) added.push(node);
    }
  });
  observer.observe(document.body, { childList: true });
  return {
    anchors: () => [...added],
    names: () => added.map((anchor) => anchor.download),
    stop: () => observer.disconnect(),
  };
}

// -- Exports ------------------------------------------------------------------

export { captureDownloads };
