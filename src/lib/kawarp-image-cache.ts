// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[KawarpImages]";
// A few covers at a time: the resume card and the Unison banner.
const MAX_CACHED_IMAGES = 8;

// -- State ---------------------------------------------------------------------

const decoded = new Map<string, ImageBitmap>();
const pending = new Map<string, Promise<ImageBitmap>>();

// -- Decoding ------------------------------------------------------------------

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load image ${src}`));
    image.src = src;
  });
}

async function decodeImage(src: string): Promise<ImageBitmap> {
  try {
    const response = await fetch(src, { mode: "cors" });
    if (response.ok) return await createImageBitmap(await response.blob());
  } catch (error) {
    console.warn(LOG_PREFIX, "fetch failed, loading through an image element", error);
  }
  return createImageBitmap(await loadImageElement(src));
}

function remember(src: string, bitmap: ImageBitmap): void {
  decoded.delete(src);
  decoded.set(src, bitmap);
  if (decoded.size <= MAX_CACHED_IMAGES) return;
  const [oldest] = decoded.keys();
  decoded.get(oldest)?.close();
  decoded.delete(oldest);
}

// -- API -----------------------------------------------------------------------

/** Decodes an image once so a Kawarp backdrop can paint it on its first frame. */
function preloadKawarpImage(src: string): Promise<ImageBitmap> {
  const ready = decoded.get(src);
  if (ready) return Promise.resolve(ready);
  const loading = pending.get(src);
  if (loading) return loading;
  const request = decodeImage(src)
    .then((bitmap) => {
      remember(src, bitmap);
      return bitmap;
    })
    .finally(() => pending.delete(src));
  pending.set(src, request);
  return request;
}

function decodedKawarpImage(src: string): ImageBitmap | undefined {
  return decoded.get(src);
}

// -- Exports -------------------------------------------------------------------

export { decodedKawarpImage, preloadKawarpImage };
