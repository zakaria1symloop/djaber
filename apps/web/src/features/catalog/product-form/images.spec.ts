// Client checks of product images (AT-CAT-04 UI side): type, weight, count, small side.
import { PRODUCT_IMAGE_MAX_BYTES, PRODUCT_IMAGES_MAX } from '@djaber/shared';
import { describe, expect, it } from 'vitest';
import { checkImageBatch, checkImageFile, IMAGE_ACCEPT, smallSide } from './images';

const png = (size = 1000) => ({ type: 'image/png', size });

describe('checkImageFile', () => {
  it('accepts jpeg / png / webp / gif up to 5 MB', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) expect(checkImageFile({ type, size: PRODUCT_IMAGE_MAX_BYTES })).toBeNull();
    expect(IMAGE_ACCEPT.split(',')).toHaveLength(4);
  });
  it('refuses another type first, then a file that is too heavy', () => {
    expect(checkImageFile({ type: 'application/pdf', size: 10 })).toBe('IMAGE_TYPE_INVALID');
    expect(checkImageFile({ type: 'image/svg+xml', size: PRODUCT_IMAGE_MAX_BYTES + 1 })).toBe('IMAGE_TYPE_INVALID');
    expect(checkImageFile(png(PRODUCT_IMAGE_MAX_BYTES + 1))).toBe('IMAGE_TOO_LARGE');
  });
});

describe('checkImageBatch', () => {
  it('the 11th image is refused with IMAGES_LIMIT', () => {
    expect(checkImageBatch([png()], PRODUCT_IMAGES_MAX).map((c) => c.error)).toEqual(['IMAGES_LIMIT']);
    expect(checkImageBatch([png(), png(), png()], PRODUCT_IMAGES_MAX - 2).map((c) => c.error)).toEqual([null, null, 'IMAGES_LIMIT']);
  });
  it('an invalid file does not take a slot', () => {
    const out = checkImageBatch([{ type: 'text/plain', size: 1 }, png(PRODUCT_IMAGE_MAX_BYTES + 1), png(), png()], PRODUCT_IMAGES_MAX - 1);
    expect(out.map((c) => c.error)).toEqual(['IMAGE_TYPE_INVALID', 'IMAGE_TOO_LARGE', null, 'IMAGES_LIMIT']);
  });
  it('keeps the file with its verdict and honours a custom maximum', () => {
    const a = png();
    expect(checkImageBatch([a], 0, 5)[0]).toEqual({ file: a, error: null });
    expect(checkImageBatch([a], 7, 5)[0]!.error).toBe('IMAGES_LIMIT');
  });
});

describe('smallSide (IMAGE_SMALL {px})', () => {
  it('returns the smallest side under 600 px, null otherwise', () => {
    expect(smallSide(480, 1200)).toBe(480);
    expect(smallSide(600, 600)).toBeNull();
    expect(smallSide(1200, 599)).toBe(599);
    expect(smallSide(0, 0)).toBeNull();
  });
});
