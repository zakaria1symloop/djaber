import axios from 'axios';
import crypto from 'crypto';
import prisma from '../config/database';

const MODE = process.env.CHARGILY_MODE || 'test';
const SECRET_KEY = process.env.CHARGILY_SECRET_KEY || '';
const BASE_URL = MODE === 'test'
  ? 'https://pay.chargily.net/test/api/v2'
  : 'https://pay.chargily.net/api/v2';

async function chargilyRequest(method: 'get' | 'post', endpoint: string, data?: Record<string, unknown>) {
  try {
    const res = method === 'get'
      ? await axios.get(`${BASE_URL}${endpoint}`, {
          headers: { Authorization: `Bearer ${SECRET_KEY}`, Accept: 'application/json' },
          params: data,
        })
      : await axios.post(`${BASE_URL}${endpoint}`, data, {
          headers: {
            Authorization: `Bearer ${SECRET_KEY}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        });
    return { success: true, data: res.data };
  } catch (error: any) {
    console.error('Chargily API error:', error.response?.data || error.message);
    return { success: false, data: error.response?.data || null, message: error.message };
  }
}

/**
 * Create a Chargily checkout session for a subscription plan.
 */
export async function createPlanCheckout({
  userId,
  userEmail,
  userName,
  planSlug,
  planName,
  amount,
  billingCycle,
}: {
  userId: string;
  userEmail: string;
  userName: string;
  planSlug: string;
  planName: string;
  amount: number;
  billingCycle: 'monthly' | 'yearly';
}) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:6001';
  const frontendUrl = process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:5175';

  const isLocal = backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1') || backendUrl.includes('192.168.');

  let successUrl = `${frontendUrl}/dashboard?section=settings&payment=success`;
  const failureUrl = `${frontendUrl}/dashboard?section=settings&payment=failed`;
  const webhookUrl = isLocal ? undefined : `${backendUrl}/api/payments/chargily-webhook`;

  const metadata = {
    user_id: userId,
    plan_slug: planSlug,
    billing_cycle: billingCycle,
    type: 'subscription',
  };

  const checkoutData: Record<string, unknown> = {
    amount: Math.round(amount),
    currency: 'dzd',
    success_url: successUrl,
    failure_url: failureUrl,
    description: `${planName} (${billingCycle})`,
    metadata,
  };

  if (webhookUrl) {
    checkoutData.webhook_endpoint = webhookUrl;
  }

  // Chargily V2 doesn't accept customer_name/customer_email as top-level params
  // Pass them in metadata instead
  if (userName) (metadata as any).customer_name = userName;
  if (userEmail) (metadata as any).customer_email = userEmail;

  const result = await chargilyRequest('post', '/checkouts', checkoutData);

  if (!result.success || !result.data?.checkout_url) {
    return { success: false, error: result.data?.message || 'Failed to create checkout' };
  }

  let checkoutUrl = result.data.checkout_url;
  if (checkoutUrl.startsWith('http://')) {
    checkoutUrl = checkoutUrl.replace('http://', 'https://');
  }

  const checkoutId = result.data.id;

  return {
    success: true,
    checkoutUrl,
    checkoutId,
    data: result.data,
  };
}

/**
 * Verify a checkout status with Chargily.
 */
export async function verifyCheckout(checkoutId: string) {
  return chargilyRequest('get', `/checkouts/${checkoutId}`);
}

/**
 * Validate Chargily webhook signature.
 */
export function validateWebhookSignature(payload: string, signature: string): boolean {
  if (!SECRET_KEY) return false;
  const computed = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}

/**
 * Handle a successful payment — create/extend subscription.
 */
export async function activateSubscriptionFromPayment(data: {
  userId: string;
  planSlug: string;
  billingCycle: string;
  checkoutId: string;
}) {
  const plan = await prisma.plan.findUnique({ where: { slug: data.planSlug } });
  if (!plan) {
    console.error('Plan not found for slug:', data.planSlug);
    return;
  }

  const now = new Date();
  const months = data.billingCycle === 'yearly' ? 12 : 1;
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + months);

  // Create subscription
  await prisma.subscription.create({
    data: {
      userId: data.userId,
      planSlug: data.planSlug,
      status: 'active',
      billingCycle: data.billingCycle,
      startDate: now,
      endDate,
      chargilySubscriptionId: data.checkoutId,
    },
  });

  // Update user's plan
  await prisma.user.update({
    where: { id: data.userId },
    data: { plan: data.planSlug },
  });

  console.log(`Subscription activated: user=${data.userId} plan=${data.planSlug} until=${endDate.toISOString()}`);
}

export function isConfigured(): boolean {
  return !!SECRET_KEY;
}
