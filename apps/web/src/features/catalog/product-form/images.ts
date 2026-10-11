// Client checks of a product image before upload (CAT-02; Figma DLG GDS II "Images — erreurs inline"):
// type → IMAGE_TYPE_INVALID, weight → IMAGE_TOO_LARGE, count → IMAGES_LIMIT, small side → IMAGE_SMALL (warning, accepted).
import { PRODUCT_IMAGE_MAX_BYTES, PRODUCT_IMAGE_MIN_PX, PRODUCT_IMAGES_MAX } from '@djaber/shared';

export const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const IMAGE_ACCEPT = IMAGE_MIMES.join(',');
export type ImageRejection = 'IMAGE_TYPE_INVALID' | 'IMAGE_TOO_LARGE' | 'IMAGES_LIMIT';
type FileLike = { type: string; size: number };

/** Rejection of one file on its own (type first, then weight), null when it may be sent. */
export const checkImageFile = (f: FileLike): Exclude<ImageRejection, 'IMAGES_LIMIT'> | null =>
  !(IMAGE_MIMES as readonly string[]).includes(f.type) ? 'IMAGE_TYPE_INVALID' : f.size > PRODUCT_IMAGE_MAX_BYTES ? 'IMAGE_TOO_LARGE' : null;

/**
 * Checks a picked batch against the room left: valid files fill the free slots in order, the following ones are
 * refused with IMAGES_LIMIT. Invalid files never take a slot.
 */
export function checkImageBatch<F extends FileLike>(files: readonly F[], existing: number, max: number = PRODUCT_IMAGES_MAX): { file: F; error: ImageRejection | null }[] {
  let free = Math.max(0, max - existing);
  return files.map((file) => {
    const own = checkImageFile(file);
    if (own) return { file, error: own };
    if (free <= 0) return { file, error: 'IMAGES_LIMIT' as const };
    free--;
    return { file, error: null };
  });
}

/** Smallest side when it is under the recommended minimum (IMAGE_SMALL {px}), else null. */
export const smallSide = (width: number, height: number, min: number = PRODUCT_IMAGE_MIN_PX): number | null => {
  const px = Math.min(width, height);
  return px > 0 && px < min ? px : null;
};

/** Pixel size of a picked file, read in the browser; null when it cannot be decoded. */
export async function readImageSize(file: Blob): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return size;
  } catch {
    return null;
  }
}

/* ---------- pictures chosen on /products/new, waiting for the product to exist ---------- */
export type LocalImage = {
  key: string;
  file: File;
  url: string;
  /** client rejection (never uploaded) or the code / message of a failed upload */
  error: string | null;
  rejected: boolean;
  smallPx: number | null;
  status: 'idle' | 'uploading' | 'error';
  progress: number;
};

/**
 * Uploads that failed right after `POST /products`: handed over to the edit page (same tab) so the tile keeps its
 * error and its "Réessayer" button. Memory only; nothing is written to web storage.
 */
const handover = new Map<string, LocalImage[]>();
export const imageHandover = {
  put: (productId: string, images: LocalImage[]) => void (images.length ? handover.set(productId, images) : handover.delete(productId)),
  take: (productId: string): LocalImage[] => {
    const list = handover.get(productId) ?? [];
    handover.delete(productId);
    return list;
  },
};
