import axios from 'axios';
import FormData from 'form-data';
import prisma from '../config/database';

/**
 * Voice-note transcription via Whisper.
 *
 * Provider preference:
 *   1. Groq (Whisper Large v3 Turbo) — fastest, cheapest.
 *   2. OpenAI Whisper — fallback.
 *
 * API keys are read from env vars first, then from the AIProvider table
 * (where the admin already manages OpenAI/Groq keys for the LLM agents).
 *
 * Whisper auto-detects language. Algerian Darja often transcribes as
 * phonetic Arabic — workable but imperfect.
 */

interface WhisperEndpoint {
  url: string;
  apiKey: string;
  model: string;
  provider: 'groq' | 'openai';
}

async function getProviderKey(provider: 'groq' | 'openai'): Promise<string | null> {
  // Env first
  const envKey = provider === 'groq' ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY;
  if (envKey) return envKey;

  // Then AIProvider table
  try {
    const row = await prisma.aIProvider.findUnique({
      where: { provider },
      select: { apiKey: true, isActive: true },
    });
    if (row?.isActive && row.apiKey) return row.apiKey;
  } catch {
    // ignore — DB unavailable, treat as no key
  }
  return null;
}

async function pickEndpoint(): Promise<WhisperEndpoint | null> {
  const groqKey = await getProviderKey('groq');
  if (groqKey) {
    return {
      url: 'https://api.groq.com/openai/v1/audio/transcriptions',
      apiKey: groqKey,
      model: 'whisper-large-v3-turbo',
      provider: 'groq',
    };
  }
  const openaiKey = await getProviderKey('openai');
  if (openaiKey) {
    return {
      url: 'https://api.openai.com/v1/audio/transcriptions',
      apiKey: openaiKey,
      model: 'whisper-1',
      provider: 'openai',
    };
  }
  return null;
}

/**
 * Download an audio attachment from a URL and transcribe it.
 * Returns the transcript text or null if transcription failed.
 */
export async function transcribeAudio(audioUrl: string, languageHint?: string): Promise<string | null> {
  const endpoint = await pickEndpoint();
  if (!endpoint) {
    console.error('Transcription skipped: no Groq or OpenAI API key configured (env or AIProvider table)');
    return null;
  }

  try {
    // 1. Download the audio file
    const audioRes = await axios.get<ArrayBuffer>(audioUrl, {
      responseType: 'arraybuffer',
      timeout: 30_000,
      maxContentLength: 25 * 1024 * 1024, // 25MB cap (Whisper hard limit)
    });

    // Facebook usually serves voice notes as audio/mp4 (m4a). Default to that.
    const contentType = audioRes.headers['content-type'] || 'audio/mp4';
    const ext = contentType.includes('mpeg') ? 'mp3'
      : contentType.includes('wav') ? 'wav'
      : contentType.includes('ogg') ? 'ogg'
      : contentType.includes('webm') ? 'webm'
      : 'm4a';

    // 2. Build multipart form
    const form = new FormData();
    form.append('file', Buffer.from(audioRes.data), { filename: `voice.${ext}`, contentType });
    form.append('model', endpoint.model);
    form.append('response_format', 'json');
    if (languageHint) {
      form.append('language', languageHint);
    }

    // 3. Call Whisper
    const t0 = Date.now();
    const result = await axios.post<{ text: string }>(endpoint.url, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${endpoint.apiKey}`,
      },
      timeout: 60_000,
    });
    const ms = Date.now() - t0;

    const text = (result.data?.text || '').trim();
    console.log(`[whisper:${endpoint.provider}] transcribed ${ext} in ${ms}ms → "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`);

    return text || null;
  } catch (error: any) {
    const msg = error.response?.data?.error?.message || error.message || 'unknown';
    console.error(`[whisper:${endpoint.provider}] failed:`, msg);
    return null;
  }
}
