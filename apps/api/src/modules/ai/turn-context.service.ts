// What a turn needs besides the conversation: the agent's knowledge (FAQ, catalogue slice), the workspace texts and the
// model the platform routes this agent to (R-H). Shared by the reply job and the playground so both build the same prompt.
import { Injectable } from '@nestjs/common';
import type { AppLocale } from '@djaber/shared';
import { DEFAULT_SYSTEM_MESSAGES, prisma, TenantContext, type Agent } from '@djaber/db';
import { CatalogueService } from './catalogue.service';
import { systemLocale, type AiLanguage } from './language';
import { isOutOfHours, promptAgentOf } from './prompt/prompt-builder';
import type { PromptContext } from './prompt/prompt.types';
import { RoutingService, type RoutedModel } from './routing.service';

export type TurnContext = { prompt: Omit<PromptContext, 'descriptionMax'>; model: RoutedModel; temperature: number; maxTokens: number };

@Injectable()
export class TurnContextService {
  constructor(
    private readonly catalogue: CatalogueService,
    private readonly routing: RoutingService,
  ) {}

  /**
   * The agent's model when it is still usable, else the text route's current model — written back to `Agent.modelId`
   * (04-ai-pipeline §6; the merchant only sees a read-only badge).
   */
  async modelOf(agent: Pick<Agent, 'id' | 'modelId'>): Promise<RoutedModel> {
    const route = await this.routing.route('text');
    const usable = [route.primary, ...(route.fallback ? [route.fallback] : [])];
    const own = usable.find((m) => m.id === agent.modelId && m.supportsTools);
    if (own && !(await this.routing.isOpen(own.id))) return own;
    const next = route.failoverActive && route.fallback ? route.fallback : route.primary;
    if (next.id !== agent.modelId) await prisma.agent.updateMany({ where: { id: agent.id }, data: { modelId: next.id } });
    return next;
  }

  async load(agent: Agent, o: { text: string; lastProductIds?: string[]; lang: AiLanguage; unclearStreak?: number; now?: Date }): Promise<TurnContext> {
    const now = o.now ?? new Date();
    const [ws, faqs, catalogue, model] = await Promise.all([
      prisma.workspace.findUniqueOrThrow({ where: { id: TenantContext.workspaceId() }, select: { name: true, locale: true, freeDeliveryThreshold: true, systemMessages: true, senderWilaya: { select: { nameFr: true } } } }),
      prisma.agentFaq.findMany({ where: { agentId: agent.id, isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { question: true, answer: true } }),
      this.catalogue.slice(agent, { text: o.text, lastProductIds: o.lastProductIds ?? [] }),
      this.modelOf(agent),
    ]);
    const a = promptAgentOf(agent);
    // a text the workspace never customised falls back to the platform default (D43), like the texts sent by the messaging module
    const stored = (ws.systemMessages ?? {}) as Record<string, Record<string, string>>;
    const systemMessages = Object.fromEntries(Object.entries(DEFAULT_SYSTEM_MESSAGES).map(([k, d]) => [k, { ...d, ...(stored[k] ?? {}) }])) as Record<string, Record<string, string>>;
    return {
      prompt: {
        agent: a,
        workspace: { name: ws.name, freeDeliveryThreshold: ws.freeDeliveryThreshold, senderWilaya: ws.senderWilaya?.nameFr ?? null, systemMessages },
        faqs: faqs.filter((f) => f.answer.trim()),
        catalogue,
        lang: o.lang,
        locale: systemLocale(o.lang, ws.locale as AppLocale),
        now,
        outOfHours: isOutOfHours(a.businessHours, now),
        unclearStreak: o.unclearStreak ?? 0,
      },
      model,
      temperature: Number(agent.temperature),
      maxTokens: agent.maxTokens,
    };
  }
}
