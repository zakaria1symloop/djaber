import prisma from '../config/database';

// Credit costs per action
export const CREDIT_COSTS = {
  AI_TEXT_MESSAGE: 1,      // Each AI response
  AI_IMAGE_RECOGNITION: 5, // Vision API call
  AI_ORDER_CREATED: 2,     // Tool call for order
};

/**
 * Check if user has enough credits. Auto-resets if billing period expired.
 */
export async function hasCredits(userId: string, cost: number = 1): Promise<{ ok: boolean; used: number; limit: number; remaining: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditsUsed: true, creditsLimit: true, creditsResetAt: true },
  });

  if (!user) return { ok: false, used: 0, limit: 0, remaining: 0 };

  // Auto-reset credits if a month has passed since last reset
  const now = new Date();
  const resetAt = new Date(user.creditsResetAt);
  const monthsPassed = (now.getFullYear() - resetAt.getFullYear()) * 12 + (now.getMonth() - resetAt.getMonth());

  if (monthsPassed >= 1) {
    await prisma.user.update({
      where: { id: userId },
      data: { creditsUsed: 0, creditsResetAt: now },
    });
    return { ok: true, used: 0, limit: user.creditsLimit, remaining: user.creditsLimit };
  }

  const remaining = Math.max(0, user.creditsLimit - user.creditsUsed);
  return {
    ok: remaining >= cost,
    used: user.creditsUsed,
    limit: user.creditsLimit,
    remaining,
  };
}

/**
 * Consume credits for an action. Returns false if insufficient.
 */
export async function consumeCredits(userId: string, cost: number, action: string): Promise<boolean> {
  const check = await hasCredits(userId, cost);
  if (!check.ok) return false;

  await prisma.user.update({
    where: { id: userId },
    data: { creditsUsed: { increment: cost } },
  });

  return true;
}

/**
 * Get credit status for a user (for the header display).
 */
export async function getCreditStatus(userId: string): Promise<{ used: number; limit: number; remaining: number; percentage: number }> {
  const check = await hasCredits(userId, 0);
  return {
    used: check.used,
    limit: check.limit,
    remaining: check.remaining,
    percentage: check.limit > 0 ? Math.round((check.used / check.limit) * 100) : 0,
  };
}

/**
 * Sync user's credit limit with their plan's monthlyCredits.
 */
export async function syncCreditsWithPlan(userId: string, planSlug: string): Promise<void> {
  const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });
  if (plan) {
    await prisma.user.update({
      where: { id: userId },
      data: { creditsLimit: plan.monthlyCredits },
    });
  }
}
