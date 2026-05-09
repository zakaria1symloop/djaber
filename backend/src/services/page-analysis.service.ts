import axios from 'axios';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import prisma from '../config/database';
import {
  fetchPagePostsFromMeta,
  fetchInstagramMediaFromMeta,
  FetchedPost,
} from './meta.service';

const GCS_BUCKET = process.env.GCS_BUCKET || 'djaber-prod-uploads';
const IS_PROD = process.env.NODE_ENV === 'production';
const BACKEND_URL = process.env.BACKEND_URL || '';

// Local fallback dir when GCS isn't configured (e.g. VPS deploy without GCP auth).
// Backend already serves /uploads as static via express.static, so the file
// becomes reachable at ${BACKEND_URL}/uploads/products/<filename>.
const LOCAL_UPLOAD_DIR = path.resolve(__dirname, '../../uploads/products');

async function saveBufferLocally(buffer: Buffer, contentType: string): Promise<string | null> {
  try {
    await fs.mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
    const filename = `fb-${crypto.randomBytes(8).toString('hex')}.${ext}`;
    await fs.writeFile(path.join(LOCAL_UPLOAD_DIR, filename), buffer);
    if (!BACKEND_URL) return null; // can't form a public URL without it
    return `${BACKEND_URL.replace(/\/+$/, '')}/uploads/products/${filename}`;
  } catch (err: any) {
    console.error('[page-analysis] local save failed:', err.message);
    return null;
  }
}

/**
 * Re-host a downloaded image so we have a short, permanent URL we can store in
 * Product.imageUrl (varchar 191). Try GCS first if a service account is
 * available; fall back to saving on the VPS's own disk.
 */
async function rehostImage(buffer: Buffer, contentType: string): Promise<string | null> {
  if (IS_PROD) {
    try {
      const { Storage } = require('@google-cloud/storage');
      const gcs = new Storage();
      const bucket = gcs.bucket(GCS_BUCKET);
      const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
      const filename = `products/fb-${crypto.randomBytes(8).toString('hex')}.${ext}`;
      const file = bucket.file(filename);
      await file.save(buffer, {
        contentType,
        metadata: { cacheControl: 'public, max-age=31536000' },
      });
      try {
        await file.makePublic();
      } catch {
        // bucket may already grant public read at the bucket level — non-fatal
      }
      return `https://storage.googleapis.com/${GCS_BUCKET}/${filename}`;
    } catch (err: any) {
      // No GCS credentials on this VPS — fall through to local disk.
      console.warn('[page-analysis] GCS unavailable, falling back to local disk:', err.message);
    }
  }
  return saveBufferLocally(buffer, contentType);
}

/**
 * Vision-based product extraction from Facebook page posts.
 * Reads each post's text + image, asks GPT-4o-mini to detect whether
 * it is a product and pull out name / description / price-in-DA.
 */

export interface ExtractedProduct {
  postId: string;
  name: string;
  description: string;
  priceDA: number;
  imageUrl: string | null;
  category: string | null;
  sourceText: string;
}

async function getOpenAIKey(): Promise<string | null> {
  const envKey = process.env.OPENAI_API_KEY;
  if (envKey) return envKey;
  try {
    const row = await prisma.aIProvider.findUnique({
      where: { provider: 'openai' },
      select: { apiKey: true, isActive: true },
    });
    if (row?.isActive && row.apiKey) return row.apiKey;
  } catch {}
  return null;
}

interface RawExtraction {
  isProduct: boolean;
  name?: string;
  description?: string;
  priceDA?: number | null;
  category?: string | null;
}

async function downloadImage(url: string): Promise<{ dataUrl: string; buffer: Buffer; contentType: string } | null> {
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: 10 * 1024 * 1024,
    });
    const contentType = (res.headers['content-type'] as string) || 'image/jpeg';
    const buffer = Buffer.from(res.data);
    const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
    return { dataUrl, buffer, contentType };
  } catch (err: any) {
    console.error(`[page-analysis] Could not download image: ${err.message}`);
    return null;
  }
}

async function extractFromPost(
  apiKey: string,
  post: FetchedPost,
): Promise<ExtractedProduct | null> {
  const imageUrl = post.fullPicture || post.attachments[0]?.url || null;
  const text = post.message || post.attachments[0]?.description || '';

  // Skip posts with neither image nor text
  if (!imageUrl && !text.trim()) return null;

  // Pre-download the image — OpenAI can't fetch FB CDN URLs directly,
  // and the URL is too long to store in our DB.
  const imageData = imageUrl ? await downloadImage(imageUrl) : null;
  const imageDataUrl = imageData?.dataUrl || null;
  // Re-host on our infra so the URL is short + permanent (FB CDN tokens expire)
  const persistentImageUrl = imageData
    ? await rehostImage(imageData.buffer, imageData.contentType)
    : null;

  const prompt = `You are cataloging products for an Algerian e-commerce merchant from their Facebook page posts.
The merchant sells products through Messenger. Most photo posts on this page ARE products — be GENEROUS.

Set "isProduct": true if you see ANY of:
- a clear photo of an item that could be sold (clothing, accessories, beauty, electronics, food, home, kids, etc.)
- a product description in the caption (even without an image)
- a price mentioned in the caption (even without a clear product photo)

Set "isProduct": false ONLY for: greetings, page announcements, job ads, location-only posts, pure text without any product reference.

Look at BOTH the image AND the caption. If the caption mentions a product or price, assume it's a product.

Reply with strict JSON only:
{
  "isProduct": boolean,
  "name": "short product name (2-6 words, language of the post — Arabic/French/Darja accepted, transliterate Darja if needed)",
  "description": "one-sentence description, language of the post",
  "priceDA": number or 0 (extract Algerian Dinar price if visible — "4500 DA", "4500دج", "4.500", etc. → 4500; 0 if no price),
  "category": "guess: clothing, beauty, electronics, food, accessories, home, kids, other"
}

Post text:
"""${text || '(no caption — judge from image alone)'}"""
`;

  const messages: any[] = [
    {
      role: 'user',
      content: imageDataUrl
        ? [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ]
        : prompt,
    },
  ];

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 300,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 30000,
      },
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as RawExtraction;
    console.log(`[page-analysis] post ${post.postId} → isProduct=${parsed.isProduct} name="${parsed.name || ''}" price=${parsed.priceDA || 0}`);
    if (!parsed.isProduct || !parsed.name) return null;

    return {
      postId: post.postId,
      name: String(parsed.name).trim().slice(0, 120),
      description: String(parsed.description || '').trim().slice(0, 400),
      priceDA: typeof parsed.priceDA === 'number' && parsed.priceDA > 0 ? Math.round(parsed.priceDA) : 0,
      // Prefer our re-hosted short URL; fall back to FB URL only if upload failed.
      imageUrl: persistentImageUrl || (imageUrl && imageUrl.length <= 190 ? imageUrl : null),
      category: parsed.category || null,
      sourceText: text.slice(0, 200),
    };
  } catch (err: any) {
    console.error(`[page-analysis] Failed to extract from post ${post.postId}:`, err.response?.data || err.message);
    return null;
  }
}

/**
 * Fetch up to N recent posts from the page, run vision extraction,
 * and return deduplicated product candidates.
 */
export async function analyzePagePosts(internalPageId: string, limit = 30): Promise<{
  pageName: string;
  pageId: string;
  scanned: number;
  extracted: ExtractedProduct[];
  warning: string | null;
}> {
  const page = await prisma.page.findUnique({ where: { id: internalPageId } });
  if (!page) throw new Error('Page not found');

  const apiKey = await getOpenAIKey();
  if (!apiKey) {
    return {
      pageName: page.pageName,
      pageId: page.id,
      scanned: 0,
      extracted: [],
      warning: 'AI vision is temporarily unavailable. Please try again in a moment or contact support.',
    };
  }

  const posts =
    page.platform === 'instagram'
      ? await fetchInstagramMediaFromMeta(page.pageId, page.pageAccessToken, limit)
      : await fetchPagePostsFromMeta(page.pageId, page.pageAccessToken, limit);
  const candidates: ExtractedProduct[] = [];

  // Sequential to keep request rate sane on large pages
  for (const post of posts) {
    const extracted = await extractFromPost(apiKey, post);
    if (extracted) candidates.push(extracted);
  }

  // De-dup by lowercased name (keep the one with the best image + price)
  const byName = new Map<string, ExtractedProduct>();
  for (const c of candidates) {
    const key = c.name.toLowerCase().trim();
    const prev = byName.get(key);
    if (!prev) {
      byName.set(key, c);
    } else {
      // Prefer the candidate with a price > 0 and an image
      const score = (p: ExtractedProduct) => (p.priceDA > 0 ? 2 : 0) + (p.imageUrl ? 1 : 0);
      if (score(c) > score(prev)) byName.set(key, c);
    }
  }

  return {
    pageName: page.pageName,
    pageId: page.id,
    scanned: posts.length,
    extracted: Array.from(byName.values()),
    warning: null,
  };
}

/**
 * Create Product rows from confirmed extractions. Each item becomes
 * a SKU under the user's main stock catalog.
 */
export async function importExtractedProducts(
  userId: string,
  items: Array<{ name: string; description?: string; priceDA: number; quantity?: number; imageUrl?: string | null; sourcePostId?: string }>,
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const item of items) {
    const cleanName = item.name.trim().slice(0, 120);
    // Defensive server-side gate — frontend already enforces these,
    // but never insert junk if the request bypasses the UI.
    if (!cleanName || !item.priceDA || item.priceDA <= 0) { skipped += 1; continue; }

    const sku = `FB-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    // Both Product.imageUrl and ProductImage.url are varchar(191) by default —
    // FB CDN URLs are way longer, so drop them rather than crash the insert.
    const safeImageUrl = item.imageUrl && item.imageUrl.length <= 190 ? item.imageUrl : null;
    const initialQuantity = typeof item.quantity === 'number' && item.quantity > 0 ? Math.floor(item.quantity) : 0;

    try {
      const product = await prisma.product.create({
        data: {
          userId,
          sku,
          name: cleanName,
          description: (item.description || '').slice(0, 1000) || null,
          sellingPrice: item.priceDA,
          quantity: initialQuantity,
          minQuantity: 1,
          unit: 'piece',
          imageUrl: safeImageUrl,
          isActive: true,
        },
      });

      // Save the source post image as a ProductImage row too
      if (safeImageUrl) {
        try {
          const filename = `fb-post-${Date.now()}.jpg`;
          await prisma.productImage.create({
            data: {
              productId: product.id,
              url: safeImageUrl,
              filename,
              isPrimary: true,
            },
          });
        } catch {
          // Non-fatal — fallback to the legacy imageUrl on Product
        }
      }

      created += 1;
    } catch (err) {
      console.error('[page-analysis] Failed to create product:', err);
      skipped += 1;
    }
  }

  return { created, skipped };
}
