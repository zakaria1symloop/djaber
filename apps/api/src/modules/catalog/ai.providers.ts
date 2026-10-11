// AI calls of the catalogue sit behind two interfaces. M2 ships deterministic implementations (no network);
// M4 (AI pipeline: `AiRoute` capability `vision`, credits, failover) binds the real providers to the same tokens.
import { createHash } from 'node:crypto';
import { AppException } from '../../core/errors/app.exception';

// --- image caption (CAT-02 "AI caption stored at upload", used by AI-06 vision matching) -----------------------------------
export const IMAGE_CAPTION_PROVIDER = Symbol('IMAGE_CAPTION_PROVIDER');
export interface ImageCaptionProvider {
  /** Short description of what the picture shows, or null when no caption can be produced. */
  caption(input: { image: Buffer; mime: string; productName: string; locale: string }): Promise<string | null>;
}
/** Until M4: no caption (`aiCaption = null`; vision pass 1 falls back to name / description, 03-events §3). */
export class StubImageCaptionProvider implements ImageCaptionProvider {
  async caption(): Promise<string | null> {
    return null;
  }
}

// --- create from photo (CAT-07, `POST /products/ai-fill`) -------------------------------------------------------------------
export const PRODUCT_VISION_PROVIDER = Symbol('PRODUCT_VISION_PROVIDER');
export type VisionPhoto = { buffer: Buffer; mime: string; fileName: string };
export type VisionSuggestion = { name: string; description: string; category: string | null; unit: string | null; attributes: Record<string, string> };
export interface ProductVisionProvider {
  /** Never returns a price (CAT-07). `categories` / `units` are the names the suggestion may pick from. */
  describe(input: { photos: VisionPhoto[]; locale: string; categories: string[]; units: string[] }): Promise<VisionSuggestion>;
}

const titleFromFile = (fileName: string) => {
  const base = fileName
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : '';
};

/** `AI_DRIVER=fake` (dev / test): same photos ⇒ same answer, derived from the file name and a hash of the bytes. */
export class FakeProductVisionProvider implements ProductVisionProvider {
  async describe(input: { photos: VisionPhoto[]; locale: string; categories: string[]; units: string[] }): Promise<VisionSuggestion> {
    const first = input.photos[0]!;
    const hash = createHash('sha256').update(first.buffer).digest();
    const name = titleFromFile(first.fileName) || `Produit ${hash.toString('hex').slice(0, 6).toUpperCase()}`;
    const text: Record<string, string> = {
      fr: `${name} — description générée à partir de ${input.photos.length} photo(s). Vérifiez-la avant de publier.`,
      ar: `${name} — وصف مُولَّد من ${input.photos.length} صورة. راجعه قبل النشر.`,
      en: `${name} — description generated from ${input.photos.length} photo(s). Review it before publishing.`,
    };
    return {
      name,
      description: text[input.locale] ?? text.fr!,
      category: input.categories.length ? input.categories[hash[0]! % input.categories.length]! : null,
      unit: input.units[0] ?? null,
      attributes: { photos: String(input.photos.length) },
    };
  }
}

/** `AI_DRIVER=live` before M4 wires a vision model: 503 IMAGE_ANALYSIS_UNAVAILABLE ("fill manually"). */
export class UnavailableProductVisionProvider implements ProductVisionProvider {
  async describe(): Promise<VisionSuggestion> {
    throw new AppException('IMAGE_ANALYSIS_UNAVAILABLE');
  }
}
