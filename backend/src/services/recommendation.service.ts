import prisma from '../config/database';

// ============================================================================
// Stopwords for keyword extraction (EN + FR + AR transliterated)
// ============================================================================
const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or',
  'not', 'no', 'nor', 'so', 'yet', 'both', 'either', 'neither', 'each',
  'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such',
  'than', 'too', 'very', 'just', 'only', 'own', 'same', 'that', 'this',
  'these', 'those', 'it', 'its', 'he', 'she', 'they', 'we', 'you',
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'en',
  'est', 'sont', 'avec', 'pour', 'par', 'sur', 'dans', 'ce', 'cette',
]);

function extractKeywords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
  return new Set(words);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}

// ============================================================================
// Types
// ============================================================================

interface RecommendationCandidate {
  productId: string;
  recommendedId: string;
  type: 'cross_sell' | 'up_sell';
  score: number;
  reason: string;
}

// ============================================================================
// Co-purchase analysis — find products frequently bought together
// ============================================================================

async function analyzeCoPurchases(userId: string): Promise<RecommendationCandidate[]> {
  const candidates: RecommendationCandidate[] = [];

  // Get all orders with their items for this user
  const orders = await prisma.order.findMany({
    where: { userId, status: { not: 'cancelled' } },
    select: {
      id: true,
      items: { select: { productId: true } },
    },
  });

  // Also get sales
  const sales = await prisma.sale.findMany({
    where: { userId },
    select: {
      id: true,
      items: { select: { productId: true } },
    },
  });

  // Build co-occurrence map: productA -> productB -> count
  const coOccurrence = new Map<string, Map<string, number>>();
  const productOrderCount = new Map<string, number>();

  const allTransactions = [...orders, ...sales];

  for (const tx of allTransactions) {
    const productIds = [...new Set(tx.items.map(i => i.productId))];

    for (const pid of productIds) {
      productOrderCount.set(pid, (productOrderCount.get(pid) || 0) + 1);
    }

    // Generate pairs
    for (let i = 0; i < productIds.length; i++) {
      for (let j = 0; j < productIds.length; j++) {
        if (i === j) continue;
        const a = productIds[i];
        const b = productIds[j];
        if (!coOccurrence.has(a)) coOccurrence.set(a, new Map());
        const inner = coOccurrence.get(a)!;
        inner.set(b, (inner.get(b) || 0) + 1);
      }
    }
  }

  // Convert to candidates with score = frequency / total orders for product A
  for (const [productId, neighbors] of coOccurrence) {
    const totalOrders = productOrderCount.get(productId) || 1;
    for (const [recommendedId, frequency] of neighbors) {
      if (frequency < 1) continue;
      const score = Math.min(frequency / totalOrders, 1);
      if (score >= 0.1) { // At least 10% co-occurrence
        candidates.push({
          productId,
          recommendedId,
          type: 'cross_sell',
          score: Math.round(score * 100) / 100,
          reason: `Bought together ${frequency} time(s) (${Math.round(score * 100)}% of orders)`,
        });
      }
    }
  }

  return candidates;
}

// ============================================================================
// Category-based up-sell — find higher-priced products in same category
// ============================================================================

async function analyzeCategoryUpSell(userId: string): Promise<RecommendationCandidate[]> {
  const candidates: RecommendationCandidate[] = [];

  const products = await prisma.product.findMany({
    where: { userId, isActive: true, categoryId: { not: null } },
    select: { id: true, name: true, categoryId: true, sellingPrice: true },
    orderBy: { sellingPrice: 'asc' },
  });

  // Group by category
  const byCategory = new Map<string, typeof products>();
  for (const p of products) {
    if (!p.categoryId) continue;
    if (!byCategory.has(p.categoryId)) byCategory.set(p.categoryId, []);
    byCategory.get(p.categoryId)!.push(p);
  }

  for (const [, categoryProducts] of byCategory) {
    if (categoryProducts.length < 2) continue;

    for (let i = 0; i < categoryProducts.length; i++) {
      const source = categoryProducts[i];
      const sourcePrice = Number(source.sellingPrice);
      if (sourcePrice <= 0) continue;

      // Find up to 3 higher-priced products
      let count = 0;
      for (let j = i + 1; j < categoryProducts.length && count < 3; j++) {
        const target = categoryProducts[j];
        const targetPrice = Number(target.sellingPrice);
        if (targetPrice <= sourcePrice) continue;

        const priceRatio = targetPrice / sourcePrice;
        // Score: closer in price = higher score (1.0x ratio → 1.0, 5x ratio → 0.2)
        const score = Math.min(1 / priceRatio, 1);
        if (score >= 0.1) {
          candidates.push({
            productId: source.id,
            recommendedId: target.id,
            type: 'up_sell',
            score: Math.round(score * 100) / 100,
            reason: `Premium alternative in same category (+${Math.round((priceRatio - 1) * 100)}% price)`,
          });
          count++;
        }
      }
    }
  }

  return candidates;
}

// ============================================================================
// Description similarity — Jaccard on product name + description keywords
// ============================================================================

async function analyzeDescriptionSimilarity(userId: string): Promise<RecommendationCandidate[]> {
  const candidates: RecommendationCandidate[] = [];

  const products = await prisma.product.findMany({
    where: { userId, isActive: true },
    select: { id: true, name: true, description: true, sellingPrice: true, categoryId: true },
  });

  // Extract keywords for each product
  const productKeywords = products.map(p => ({
    ...p,
    keywords: extractKeywords(`${p.name} ${p.description || ''}`),
  }));

  // Compare all pairs (O(n^2) but products per user is typically small)
  for (let i = 0; i < productKeywords.length; i++) {
    for (let j = i + 1; j < productKeywords.length; j++) {
      const a = productKeywords[i];
      const b = productKeywords[j];

      // Skip same-category pairs (already handled by category up-sell)
      if (a.categoryId && a.categoryId === b.categoryId) continue;

      const similarity = jaccardSimilarity(a.keywords, b.keywords);
      if (similarity < 0.15) continue; // At least 15% keyword overlap

      const priceA = Number(a.sellingPrice);
      const priceB = Number(b.sellingPrice);

      // Determine type based on price difference
      if (priceB > priceA * 1.2) {
        // B is significantly more expensive → up-sell A→B
        candidates.push({
          productId: a.id,
          recommendedId: b.id,
          type: 'up_sell',
          score: Math.round(similarity * 100) / 100,
          reason: `Similar product description (${Math.round(similarity * 100)}% match)`,
        });
      } else if (priceA > priceB * 1.2) {
        // A is significantly more expensive → up-sell B→A
        candidates.push({
          productId: b.id,
          recommendedId: a.id,
          type: 'up_sell',
          score: Math.round(similarity * 100) / 100,
          reason: `Similar product description (${Math.round(similarity * 100)}% match)`,
        });
      } else {
        // Similar price → cross-sell both directions
        candidates.push({
          productId: a.id,
          recommendedId: b.id,
          type: 'cross_sell',
          score: Math.round(similarity * 100) / 100,
          reason: `Related products (${Math.round(similarity * 100)}% description match)`,
        });
        candidates.push({
          productId: b.id,
          recommendedId: a.id,
          type: 'cross_sell',
          score: Math.round(similarity * 100) / 100,
          reason: `Related products (${Math.round(similarity * 100)}% description match)`,
        });
      }
    }
  }

  return candidates;
}

// ============================================================================
// Main: Generate all recommendations
// ============================================================================

export async function generateRecommendations(userId: string): Promise<number> {
  // Run all analyses in parallel
  const [coPurchase, categoryUpSell, descriptionSim] = await Promise.all([
    analyzeCoPurchases(userId),
    analyzeCategoryUpSell(userId),
    analyzeDescriptionSimilarity(userId),
  ]);

  // Merge: key = "productId:recommendedId:type", keep highest score
  const merged = new Map<string, RecommendationCandidate>();

  for (const candidate of [...coPurchase, ...categoryUpSell, ...descriptionSim]) {
    const key = `${candidate.productId}:${candidate.recommendedId}:${candidate.type}`;
    const existing = merged.get(key);
    if (!existing || candidate.score > existing.score) {
      merged.set(key, candidate);
    }
  }

  // Upsert into database
  let count = 0;
  for (const candidate of merged.values()) {
    await prisma.productRecommendation.upsert({
      where: {
        userId_productId_recommendedId_type: {
          userId,
          productId: candidate.productId,
          recommendedId: candidate.recommendedId,
          type: candidate.type,
        },
      },
      update: {
        score: candidate.score,
        reason: candidate.reason,
        updatedAt: new Date(),
      },
      create: {
        userId,
        productId: candidate.productId,
        recommendedId: candidate.recommendedId,
        type: candidate.type,
        score: candidate.score,
        reason: candidate.reason,
      },
    });
    count++;
  }

  return count;
}

// ============================================================================
// Get recommendations for a product (used by AI agent)
// ============================================================================

export async function getRecommendationsForProduct(
  userId: string,
  productId: string
) {
  return prisma.productRecommendation.findMany({
    where: { userId, productId, isActive: true },
    include: {
      recommended: {
        select: { id: true, name: true, sellingPrice: true, quantity: true, sku: true },
      },
    },
    orderBy: { score: 'desc' },
    take: 5,
  });
}

// ============================================================================
// Get recommendations map for multiple products (batch, for AI catalog)
// ============================================================================

export async function getRecommendationsMap(userId: string, productIds: string[]) {
  const recs = await prisma.productRecommendation.findMany({
    where: { userId, productId: { in: productIds }, isActive: true },
    include: {
      recommended: {
        select: { id: true, name: true, sellingPrice: true, quantity: true },
      },
    },
    orderBy: { score: 'desc' },
  });

  // Group by source productId, limit 3 per product
  const map = new Map<string, typeof recs>();
  for (const rec of recs) {
    const list = map.get(rec.productId) || [];
    if (list.length < 3) {
      list.push(rec);
      map.set(rec.productId, list);
    }
  }
  return map;
}

// ============================================================================
// Track impression (AI mentioned a recommendation)
// ============================================================================

export async function trackImpressions(recommendationIds: string[]) {
  if (recommendationIds.length === 0) return;
  await prisma.productRecommendation.updateMany({
    where: { id: { in: recommendationIds } },
    data: { impressions: { increment: 1 } },
  });
}

// ============================================================================
// Track conversion (customer bought a recommended product)
// ============================================================================

export async function trackConversion(
  userId: string,
  sourceProductId: string,
  recommendedProductId: string,
  revenue: number
) {
  // Find the matching recommendation
  const rec = await prisma.productRecommendation.findFirst({
    where: {
      userId,
      productId: sourceProductId,
      recommendedId: recommendedProductId,
      isActive: true,
    },
  });

  if (rec) {
    await prisma.productRecommendation.update({
      where: { id: rec.id },
      data: {
        conversions: { increment: 1 },
        revenue: { increment: revenue },
      },
    });
  }
}
