// Storage layout of a product image: `ws/<workspaceId>/product/<uuid>/original.<ext>` right after the upload, then
// `image.webp` (≤ 2048 px, EXIF stripped) + `thumb.webp` (400 px) once the `media.reencode-image` job has run.
export const IMAGE_FILE = 'image.webp';
export const THUMB_FILE = 'thumb.webp';
export const THUMB_PX = 400;
export const IMAGE_MAX_PX = 2048;

export const isProcessed = (storageKey: string) => storageKey.endsWith(`/${IMAGE_FILE}`);
export const folderOf = (storageKey: string) => storageKey.slice(0, storageKey.lastIndexOf('/'));
/** Thumbnail URL of a normalised image; the image itself while it is still being processed. */
export const thumbUrlOf = (url: string) => (url.endsWith(`/${IMAGE_FILE}`) ? `${url.slice(0, -IMAGE_FILE.length)}${THUMB_FILE}` : url);
