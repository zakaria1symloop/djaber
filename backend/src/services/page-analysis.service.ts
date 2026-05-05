import axios from 'axios';
import prisma from '../config/database';
import { fetchPagePostsFromMeta, FetchedPost } from './meta.service';

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

async function extractFromPost(
  apiKey: string,
  post: FetchedPost,
): Promise<ExtractedProduct | null> {
  const imageUrl = post.fullPicture || post.attachments[0]?.url || null;
  const text = post.message || post.attachments[0]?.description || '';

  // Skip posts with neither image nor text
  if (!imageUrl && !text.trim()) return null;

  const prompt = `You are analyzing a Facebook post from an Algerian e-commerce page.
Decide whether this post is advertising a SPECIFIC PRODUCT (not a general announcement, greeting, or job ad).

Reply with strict JSON only — no markdown, no commentary:
{
  "isProduct": boolean,
  "name": "short product name (3-6 words, in the language of the post)",
  "description": "one-sentence description in the language of the post",
  "priceDA": number or null (extract Algerian Dinar price if mentioned, e.g. "4500 DA" → 4500; null if no price),
  "category": "guess: clothing, beauty, electronics, food, accessories, home, kids, other"
}

Post text:
${text || '(no caption)'}
`;

  const messages: any[] = [
    {
      role: 'user',
      content: imageUrl
        ? [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } },
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
    if (!parsed.isProduct || !parsed.name) return null;

    return {
      postId: post.postId,
      name: String(parsed.name).trim().slice(0, 120),
      description: String(parsed.description || '').trim().slice(0, 400),
      priceDA: typeof parsed.priceDA === 'number' && parsed.priceDA > 0 ? Math.round(parsed.priceDA) : 0,
      imageUrl,
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
      warning: 'No OpenAI API key configured. Add one under Admin → AI Providers.',
    };
  }

  const posts = await fetchPagePostsFromMeta(page.pageId, page.pageAccessToken, limit);
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
  items: Array<{ name: string; description?: string; priceDA: number; imageUrl?: string | null; sourcePostId?: string }>,
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const item of items) {
    const cleanName = item.name.trim().slice(0, 120);
    if (!cleanName) { skipped += 1; continue; }

    const sku = `FB-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    try {
      const product = await prisma.product.create({
        data: {
          userId,
          sku,
          name: cleanName,
          description: (item.description || '').slice(0, 1000) || null,
          sellingPrice: item.priceDA > 0 ? item.priceDA : 0,
          quantity: 0,
          minQuantity: 1,
          unit: 'piece',
          imageUrl: item.imageUrl || null,
          isActive: true,
        },
      });

      // Save the source post image as a ProductImage row too
      if (item.imageUrl) {
        try {
          const filename = `fb-post-${Date.now()}.jpg`;
          await prisma.productImage.create({
            data: {
              productId: product.id,
              url: item.imageUrl,
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
