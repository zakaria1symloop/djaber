// Image limits shared by the avatar and logo uploads.
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
/** Client-side check before the upload, same limits as the API (api-contract §1.10: image ≤ 5 MB, jpeg/png/webp/gif). */
export const checkImage = (f: { type: string; size: number }): 'IMAGE_TYPE_INVALID' | 'IMAGE_TOO_LARGE' | null =>
  !IMAGE_TYPES.includes(f.type) ? 'IMAGE_TYPE_INVALID' : f.size > IMAGE_MAX_BYTES ? 'IMAGE_TOO_LARGE' : null;
