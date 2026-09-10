import { Request, Response } from 'express';
import axios from 'axios';
import prisma from '../config/database';
import { ApiError, fail, handleError, type ErrorCode, type Params } from '../errors';
import { Validator } from '../middleware/validate';

const AI_PROVIDERS = ['openai', 'anthropic', 'google', 'groq'] as const;

// ============================================================================
// Get active providers + models (public — for agent form)
// ============================================================================

export const getActiveProviders = async (_req: Request, res: Response): Promise<void> => {
  try {
    const providers = await prisma.aIProvider.findMany({
      where: { isActive: true },
      select: {
        provider: true,
        displayName: true,
        models: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const result = providers.map((p) => ({
      provider: p.provider,
      displayName: p.displayName,
      models: JSON.parse(p.models) as string[],
    }));

    res.json({ providers: result });
  } catch (error) {
    handleError(_req, res, error);
  }
};

// ============================================================================
// Get all providers (admin)
// ============================================================================

export const getAllProviders = async (req: Request, res: Response): Promise<void> => {
  try {
    const providers = await prisma.aIProvider.findMany({
      orderBy: { createdAt: 'asc' },
    });

    // Mask API keys for security — only show last 8 chars
    const result = providers.map((p) => ({
      ...p,
      apiKey: p.apiKey ? `...${p.apiKey.slice(-8)}` : '',
      models: JSON.parse(p.models),
    }));

    res.json({ providers: result });
  } catch (error) {
    return handleError(req, res, error, 'AI_PROVIDER_LIST_FAILED');
  }
};

// ============================================================================
// Update provider (admin — set API key, toggle active)
// ============================================================================

export const updateProvider = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const v = new Validator();
    const provider = v.oneOf(req.params.provider, 'provider', AI_PROVIDERS);
    let apiKey: string | undefined;
    if (body.apiKey !== undefined && body.apiKey !== null) {
      if (typeof body.apiKey !== 'string') v.add('apiKey', 'FIELD_INVALID');
      else apiKey = body.apiKey.trim();
    }
    let isActive: boolean | undefined;
    if (body.isActive !== undefined && body.isActive !== null) {
      if (typeof body.isActive !== 'boolean') v.add('isActive', 'FIELD_INVALID');
      else isActive = body.isActive;
    }
    let models: string[] | undefined;
    if (body.models !== undefined && body.models !== null) {
      if (!Array.isArray(body.models) || body.models.some((m) => typeof m !== 'string' || m.trim() === '')) {
        v.add('models', 'FIELD_INVALID');
      } else {
        models = (body.models as string[]).map((m) => m.trim());
      }
    }
    v.throwIfAny();

    const existing = await prisma.aIProvider.findUnique({ where: { provider } });
    if (!existing) return fail(req, res, 'AI_PROVIDER_NOT_FOUND');

    const updateData: { apiKey?: string; isActive?: boolean; models?: string } = {};
    if (apiKey !== undefined) updateData.apiKey = apiKey;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (models !== undefined) updateData.models = JSON.stringify(models);

    const updated = await prisma.aIProvider.update({
      where: { provider },
      data: updateData,
    });

    res.json({
      provider: {
        ...updated,
        apiKey: updated.apiKey ? `...${updated.apiKey.slice(-8)}` : '',
        models: JSON.parse(updated.models),
      },
    });
  } catch (error) {
    return handleError(req, res, error, 'AI_PROVIDER_UPDATE_FAILED');
  }
};

// ============================================================================
// Test provider connectivity (admin — verify API key actually works)
// ============================================================================

interface TestResult {
  ok: true;
  message: string;
  models?: string[]; // Chat-capable models the key actually has access to
  modelsAvailable?: number; // Count, may be larger than models.length
  latencyMs?: number;
}

/** Failure of the connectivity test: carries the error code + params answered to the client. */
class ProviderTestError extends Error {
  constructor(readonly code: ErrorCode, readonly params?: Params) {
    super(String(code));
    this.name = 'ProviderTestError';
  }
}

/**
 * Filter raw model lists down to text-generation chat models we can actually
 * use as agent backbones. Sorted with the most recent / capable on top.
 */
function pickOpenAIChatModels(ids: string[]): string[] {
  const interesting = ids.filter(
    (id) =>
      /^gpt-4o(\b|-)/.test(id) ||
      /^gpt-4-turbo/.test(id) ||
      /^gpt-4(\b|-)/.test(id) ||
      /^gpt-3\.5-turbo/.test(id) ||
      /^o1(\b|-)/.test(id) ||
      /^o3(\b|-)/.test(id),
  );
  // Drop dated snapshots and embeddings, prefer canonical aliases
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of interesting) {
    if (/-\d{4}-\d{2}-\d{2}$/.test(id)) continue; // skip 2024-08-06 snapshots
    if (/embedding|whisper|tts|audio|search/i.test(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.sort();
}

function pickGroqChatModels(ids: string[]): string[] {
  return ids
    .filter((id) => !/whisper|guard|tts|embedding/i.test(id))
    .sort();
}

function pickGoogleModels(items: Array<{ name?: string; supportedGenerationMethods?: string[] }>): string[] {
  return items
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => (m.name || '').replace(/^models\//, ''))
    .filter((n) => /^gemini/i.test(n))
    .sort();
}

async function testProviderKey(provider: string, apiKey: string): Promise<TestResult> {
  const t0 = Date.now();
  try {
    if (provider === 'openai') {
      const r = await axios.get('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000,
      });
      const all = Array.isArray(r.data?.data) ? r.data.data.map((m: any) => String(m.id)) : [];
      const models = pickOpenAIChatModels(all);
      return {
        ok: true,
        message: 'Key valid. OpenAI responded successfully.',
        models,
        modelsAvailable: all.length,
        latencyMs: Date.now() - t0,
      };
    }

    if (provider === 'groq') {
      const r = await axios.get('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000,
      });
      const all = Array.isArray(r.data?.data) ? r.data.data.map((m: any) => String(m.id)) : [];
      const models = pickGroqChatModels(all);
      return {
        ok: true,
        message: 'Key valid. Groq responded successfully.',
        models,
        modelsAvailable: all.length,
        latencyMs: Date.now() - t0,
      };
    }

    if (provider === 'anthropic') {
      // Anthropic doesn't have a public list-models GET; use a minimal completion
      // 1-token output to keep cost effectively zero (~$0.000002).
      const r = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          timeout: 10000,
        },
      );
      // Anthropic has a stable, public model lineup we can return statically.
      const models = [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
      ];
      if (!r.data) throw new ProviderTestError('AI_PROVIDER_UNREACHABLE', { detail: 'empty response' });
      return {
        ok: true,
        message: 'Key valid. Anthropic responded successfully.',
        models,
        modelsAvailable: models.length,
        latencyMs: Date.now() - t0,
      };
    }

    if (provider === 'google') {
      const r = await axios.get(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
        { timeout: 10000 },
      );
      const items = Array.isArray(r.data?.models) ? r.data.models : [];
      const models = pickGoogleModels(items);
      return {
        ok: true,
        message: 'Key valid. Google AI responded successfully.',
        models,
        modelsAvailable: items.length,
        latencyMs: Date.now() - t0,
      };
    }

    throw new ProviderTestError('AI_PROVIDER_TEST_UNSUPPORTED', { provider });
  } catch (err: any) {
    if (err instanceof ProviderTestError) throw err;
    const status = err.response?.status;
    let apiMsg =
      err.response?.data?.error?.message ||
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message ||
      '';

    // Scrub the noisy masked key OpenAI/others echo back, plus any URLs/IDs.
    apiMsg = String(apiMsg)
      // sk-proj-XXXXX... or sk-XXXXX... possibly with asterisks
      .replace(/sk-[A-Za-z0-9_-]*\*+[A-Za-z0-9_-]*/g, '[redacted key]')
      .replace(/[*]{4,}/g, '***')
      // OpenAI link suggestion
      .replace(/\.?\s*You can find your API key at https?:\/\/\S+/i, '')
      .trim();

    // Hard cap so absurd messages don't blow up the UI either.
    if (apiMsg.length > 240) apiMsg = apiMsg.slice(0, 240) + '…';

    if (status === 401 || status === 403) {
      throw new ProviderTestError('AI_PROVIDER_KEY_REJECTED', { status, detail: apiMsg });
    }
    if (status === 429) {
      throw new ProviderTestError('AI_PROVIDER_RATE_LIMITED', { detail: apiMsg });
    }
    throw new ProviderTestError('AI_PROVIDER_UNREACHABLE', {
      status: status ?? null,
      detail: status ? `HTTP ${status}${apiMsg ? `: ${apiMsg}` : ''}` : apiMsg || err.code || 'network error',
    });
  }
}

export const testProvider = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = new Validator();
    const provider = v.oneOf(req.params.provider, 'provider', AI_PROVIDERS);
    v.throwIfAny();

    const row = await prisma.aIProvider.findUnique({ where: { provider } });
    if (!row) return fail(req, res, 'AI_PROVIDER_NOT_FOUND');
    if (!row.apiKey) return fail(req, res, 'AI_PROVIDER_NO_KEY');

    let result: TestResult;
    try {
      result = await testProviderKey(provider, row.apiKey);
    } catch (testErr) {
      if (testErr instanceof ProviderTestError) throw new ApiError(testErr.code, testErr.params);
      throw testErr;
    }

    // On success, persist the live model list so the agent form auto-shows
    // exactly what this key has access to (no stale seed values).
    if (result.ok && result.models && result.models.length > 0) {
      try {
        await prisma.aIProvider.update({
          where: { provider },
          data: { models: JSON.stringify(result.models) },
        });
      } catch (persistErr) {
        console.warn(`Could not persist models for ${provider}:`, persistErr);
      }
    }

    res.json(result);
  } catch (error) {
    return handleError(req, res, error, 'AI_PROVIDER_TEST_FAILED');
  }
};
