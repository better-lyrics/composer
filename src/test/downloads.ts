// -- Types --------------------------------------------------------------------

interface DownloadCapture {
  anchors: () => HTMLAnchorElement[];
  names: () => string[];
  blobs: () => Blob[];
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
  const blobs: Blob[] = [];
  const originalCreate = URL.createObjectURL;
  URL.createObjectURL = (source: Blob | MediaSource) => {
    if (source instanceof Blob) blobs.push(source);
    return originalCreate(source);
  };
  return {
    anchors: () => [...added],
    names: () => added.map((anchor) => anchor.download),
    blobs: () => [...blobs],
    stop: () => {
      observer.disconnect();
      URL.createObjectURL = originalCreate;
    },
  };
}

// -- Exports ------------------------------------------------------------------

export { captureDownloads };
