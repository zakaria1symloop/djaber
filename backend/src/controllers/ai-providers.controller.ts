import { Request, Response } from 'express';
import axios from 'axios';
import prisma from '../config/database';

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
    console.error('Get active providers error:', error);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
};

// ============================================================================
// Get all providers (admin)
// ============================================================================

export const getAllProviders = async (_req: Request, res: Response): Promise<void> => {
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
    console.error('Get all providers error:', error);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
};

// ============================================================================
// Update provider (admin — set API key, toggle active)
// ============================================================================

export const updateProvider = async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = String(req.params.provider);
    const { apiKey, isActive, models } = req.body;

    const existing = await prisma.aIProvider.findUnique({ where: { provider } });
    if (!existing) {
      res.status(404).json({ error: 'Provider not found' });
      return;
    }

    const updateData: any = {};
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
    console.error('Update provider error:', error);
    res.status(500).json({ error: 'Failed to update provider' });
  }
};

// ============================================================================
// Test provider connectivity (admin — verify API key actually works)
// ============================================================================

interface TestResult {
  ok: boolean;
  message: string;
  modelsAvailable?: number;
  latencyMs?: number;
}

async function testProviderKey(provider: string, apiKey: string): Promise<TestResult> {
  const t0 = Date.now();
  try {
    if (provider === 'openai') {
      const r = await axios.get('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000,
      });
      return {
        ok: true,
        message: 'Key valid. OpenAI responded successfully.',
        modelsAvailable: Array.isArray(r.data?.data) ? r.data.data.length : undefined,
        latencyMs: Date.now() - t0,
      };
    }

    if (provider === 'groq') {
      const r = await axios.get('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000,
      });
      return {
        ok: true,
        message: 'Key valid. Groq responded successfully.',
        modelsAvailable: Array.isArray(r.data?.data) ? r.data.data.length : undefined,
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
      return {
        ok: !!r.data,
        message: 'Key valid. Anthropic responded successfully.',
        latencyMs: Date.now() - t0,
      };
    }

    if (provider === 'google') {
      const r = await axios.get(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
        { timeout: 10000 },
      );
      return {
        ok: true,
        message: 'Key valid. Google AI responded successfully.',
        modelsAvailable: Array.isArray(r.data?.models) ? r.data.models.length : undefined,
        latencyMs: Date.now() - t0,
      };
    }

    return { ok: false, message: `Test not implemented for provider "${provider}".` };
  } catch (err: any) {
    const status = err.response?.status;
    const apiMsg =
      err.response?.data?.error?.message ||
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message;
    if (status === 401 || status === 403) {
      return { ok: false, message: `Key rejected (${status}). ${apiMsg}` };
    }
    if (status === 429) {
      return { ok: false, message: `Rate-limited (429). Key looks valid but the provider is throttling: ${apiMsg}` };
    }
    return {
      ok: false,
      message: status ? `HTTP ${status}: ${apiMsg}` : `Network error: ${apiMsg || err.code || 'unknown'}`,
    };
  }
}

export const testProvider = async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = String(req.params.provider);
    const row = await prisma.aIProvider.findUnique({ where: { provider } });
    if (!row) {
      res.status(404).json({ ok: false, message: 'Provider not found' });
      return;
    }
    if (!row.apiKey) {
      res.status(400).json({ ok: false, message: 'No API key is set for this provider yet.' });
      return;
    }
    const result = await testProviderKey(provider, row.apiKey);
    res.json(result);
  } catch (error: any) {
    console.error('Test provider error:', error?.message || error);
    res.status(500).json({ ok: false, message: 'Internal error while testing the key.' });
  }
};
