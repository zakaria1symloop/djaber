// Wire types of the agents module: the read models and inputs of `@djaber/shared` (`schemas/agents.ts`, one source
// for the API and the web — api-contract §3.4, 06 "Agents & AI" + §8.7, 04-ai-pipeline §8 / §14) under the names the
// screens use, plus the list envelope and the static catalogues of the wizard.
import type {
  AgentBusinessHours,
  AgentDto,
  AgentFaqDto,
  AgentGenerationResult,
  AgentInsightDto,
  AgentLanguage,
  AgentMetricsDto,
  AgentPresetDto,
  AgentReadinessCheck,
  AgentReadinessDto,
  AgentRefView,
  AgentTestLinkDto,
  AgentTestScenarioDto,
  AgentUpdatedEvent,
  AgentVersionCreatedEvent,
  AgentVersionDiffDto,
  AgentVersionDto,
  AgentWizardFields,
  AgentWizardInput,
  AiRouteBadgeDto,
  AiRunDto,
  ChannelRefView,
  CreateAgentInput,
  PlaygroundCard,
  PlaygroundToolCall,
  PlaygroundTurnDto,
  PlaygroundTurnInput,
  ResolveInsightInput,
  SharedTestInfoDto,
  SharedTestReplyDto,
  TestScenarioKey,
  UpdateAgentInput,
} from '@djaber/shared';
import { AGENT_LANGUAGES, HANDOFF_RULE_KINDS, ORDER_FIELD_KEYS, ORDER_FIELDS_LOCKED, TestScenarioKeyValues } from '@djaber/shared';

export { AGENT_FAQ_MAX_CHARS as FAQ_MAX_CHARS, AGENT_FAQ_MAX_ENTRIES as FAQ_MAX_ENTRIES, PLAYGROUND_TURNS_PER_HOUR as PLAYGROUND_LIMIT_PER_HOUR } from '@djaber/shared';
export type { AgentLanguage, AgentWizardFields, AgentWizardInput, TestScenarioKey };
export type ChannelRef = ChannelRefView;
export type AgentStatus = AgentDto['status'];
export type AgentRef = AgentRefView;
export type Personality = AgentDto['personality'];
export type AgentTone = NonNullable<AgentWizardFields['tone']>;
export type Formality = NonNullable<AgentWizardFields['formality']>;
export type EmojiLevel = NonNullable<AgentWizardFields['emojiLevel']>;
export type AvatarMode = AgentWizardFields['avatarMode'];
export type PolicyKey = 'delivery' | 'payment' | 'returns' | 'hours';
export type CapabilityKey = keyof AgentWizardFields['capabilities'];
export type OrderFieldKey = (typeof ORDER_FIELD_KEYS)[number];
export type HandoffRuleKind = (typeof HANDOFF_RULE_KINDS)[number];
export type BusinessHours = AgentBusinessHours;

export type Agent = AgentDto;
export type AgentMetrics = AgentDto['metrics30d'];
export type AgentPeriodMetrics = AgentMetricsDto;
export type PlanLimit = { limit: number; current: number };
/** `GET /agents` → `{ data: Agent[], meta: { planLimit } }` (same envelope as `/channels`). */
export type AgentsList = { rows: Agent[]; planLimit: PlanLimit | null };
export type AgentPreset = AgentPresetDto;
export type CreateAgentBody = CreateAgentInput;
export type UpdateAgentBody = UpdateAgentInput;
export type AgentFaq = AgentFaqDto;
export type FaqSource = AgentFaqDto['source'];
export type AgentVersion = AgentVersionDto;
export type AgentVersionDiff = AgentVersionDiffDto;
export type ReadinessCheck = AgentReadinessCheck;
export type AgentReadiness = AgentReadinessDto;
export type ScenarioRun = AgentTestScenarioDto;

/* ---------- playground ---------- */
export type TurnStatus = PlaygroundTurnDto['status'];
export type ToolCall = Omit<PlaygroundToolCall, 'simulated'> & { simulated?: boolean };
export type TurnCard = PlaygroundCard;
export type PlaygroundTurn = PlaygroundTurnDto;
export type PlaygroundBody = PlaygroundTurnInput;
export type PlaygroundMessage = PlaygroundBody['messages'][number];
export type TestLink = AgentTestLinkDto;
/** `GET /agent-test/:token` (public) */
export type SharedTest = SharedTestInfoDto;
export type SharedReply = SharedTestReplyDto;

/* ---------- insights ---------- */
export type AgentInsight = AgentInsightDto;
export type InsightType = AgentInsightDto['type'];
export type InsightStatus = AgentInsightDto['status'];
export type ResolveInsightBody = ResolveInsightInput;
export type InsightResolveAction = ResolveInsightInput['action'];
export type InsightCounts = { pending: number; resolved: number; dismissed: number };

export type GenerationResult = AgentGenerationResult;
export type AiRun = AiRunDto;
export type AiRoute = AiRouteBadgeDto;
/** WS `agent.updated` (03-events §2) */
export type WsAgentUpdated = Partial<AgentUpdatedEvent>;
/** WS `agent.version_created` (api-contract §5) */
export type WsAgentVersion = AgentVersionCreatedEvent;

/* ---------- static catalogues of the wizard (03 §30 AGV-02) ---------- */
export const WIZARD_STEPS = ['identity', 'knowledge', 'behaviour', 'channels', 'activate'] as const;
export type WizardStepKey = (typeof WIZARD_STEPS)[number];
export const LANGUAGES: readonly AgentLanguage[] = AGENT_LANGUAGES;
export const TONES: AgentTone[] = ['warm', 'professional', 'casual', 'premium'];
export const FORMALITIES: Formality[] = ['follow_customer', 'tu', 'vous'];
export const EMOJI_LEVELS: EmojiLevel[] = ['none', 'moderate', 'many'];
export const POLICY_KEYS: PolicyKey[] = ['delivery', 'payment', 'returns', 'hours'];
export const CAPABILITY_KEYS: CapabilityKey[] = ['replyText', 'imageRecognition', 'voiceTranscription', 'takeOrders', 'quoteDelivery', 'crossSell'];
export const ORDER_FIELDS: { key: OrderFieldKey; locked: boolean }[] = ORDER_FIELD_KEYS.map((key) => ({ key, locked: ORDER_FIELDS_LOCKED.includes(key) }));
/** Rows of "Passer la main à un humain" as drawn: the first one groups human request / refund / complaint. */
export const HANDOFF_RULES: HandoffRuleKind[] = ['human_request', 'anger', '3_unclear', 'off_topic', 'over_limits', 'risky_client', 'keyword'];
export const SCENARIO_KEYS: readonly TestScenarioKey[] = TestScenarioKeyValues;
