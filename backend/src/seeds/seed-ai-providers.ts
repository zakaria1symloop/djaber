import prisma from '../config/database';

const providers = [
  {
    provider: 'openai',
    displayName: 'OpenAI',
    apiKey: process.env.OPENAI_API_KEY || '',
    isActive: true,
    models: JSON.stringify(['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']),
  },
  {
    provider: 'anthropic',
    displayName: 'Anthropic',
    apiKey: '',
    isActive: false,
    models: JSON.stringify(['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229']),
  },
  {
    provider: 'google',
    displayName: 'Google',
    apiKey: '',
    isActive: false,
    models: JSON.stringify(['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash']),
  },
  {
    provider: 'groq',
    displayName: 'Groq',
    apiKey: '',
    isActive: false,
    models: JSON.stringify([
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
      'deepseek-r1-distill-llama-70b',
    ]),
  },
];

async function seed() {
  for (const p of providers) {
    await prisma.aIProvider.upsert({
      where: { provider: p.provider },
      update: {
        displayName: p.displayName,
        apiKey: p.apiKey,
        isActive: p.isActive,
        models: p.models,
      },
      create: p,
    });
    console.log(`Seeded provider: ${p.displayName} (active: ${p.isActive})`);
  }
  console.log('Done.');
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
