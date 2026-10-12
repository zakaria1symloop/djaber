// Request DTOs of the agents module: shared zod schemas (packages/shared/src/schemas/agents.ts) wrapped for nestjs-zod.
import { createZodDto } from 'nestjs-zod';
import {
  ActivateAgentSchema,
  AgentBulkSchema,
  AgentFaqInputSchema,
  AgentFaqUpdateSchema,
  AgentMetricsQuerySchema,
  AgentsQuerySchema,
  AgentVersionDiffQuerySchema,
  AnalysisImportSchema,
  ApplyGenerationSchema,
  ApplyPresetUpdateSchema,
  BulkDismissInsightsSchema,
  CreateAgentSchema,
  FaqExtractSchema,
  GenerateAgentSchema,
  IcebreakerSchema,
  InsightsQuerySchema,
  PauseAgentSchema,
  PlaygroundExportQuerySchema,
  PlaygroundFlagSchema,
  PlaygroundTurnSchema,
  ResolveInsightSchema,
  SetChannelAgentSchema,
  SharedTestMessageSchema,
  TestLinkSchema,
  UpdateAgentSchema,
} from '@djaber/shared';

export class AgentsQueryDto extends createZodDto(AgentsQuerySchema) {}
export class CreateAgentDto extends createZodDto(CreateAgentSchema) {}
export class UpdateAgentDto extends createZodDto(UpdateAgentSchema) {}
export class ActivateAgentDto extends createZodDto(ActivateAgentSchema) {}
export class PauseAgentDto extends createZodDto(PauseAgentSchema) {}
export class AgentBulkDto extends createZodDto(AgentBulkSchema) {}
export class AgentMetricsQueryDto extends createZodDto(AgentMetricsQuerySchema) {}
export class ApplyPresetUpdateDto extends createZodDto(ApplyPresetUpdateSchema) {}
export class AgentVersionDiffQueryDto extends createZodDto(AgentVersionDiffQuerySchema) {}
export class AgentFaqDto extends createZodDto(AgentFaqInputSchema) {}
export class AgentFaqUpdateDto extends createZodDto(AgentFaqUpdateSchema) {}
export class FaqExtractDto extends createZodDto(FaqExtractSchema) {}
export class InsightsQueryDto extends createZodDto(InsightsQuerySchema) {}
export class ResolveInsightDto extends createZodDto(ResolveInsightSchema) {}
export class BulkDismissInsightsDto extends createZodDto(BulkDismissInsightsSchema) {}
export class PlaygroundTurnDto extends createZodDto(PlaygroundTurnSchema) {}
export class PlaygroundFlagDto extends createZodDto(PlaygroundFlagSchema) {}
export class PlaygroundExportQueryDto extends createZodDto(PlaygroundExportQuerySchema) {}
export class TestLinkDto extends createZodDto(TestLinkSchema) {}
export class SharedTestMessageDto extends createZodDto(SharedTestMessageSchema) {}
export class GenerateAgentDto extends createZodDto(GenerateAgentSchema) {}
export class ApplyGenerationDto extends createZodDto(ApplyGenerationSchema) {}
export class AnalysisImportDto extends createZodDto(AnalysisImportSchema) {}
export class SetChannelAgentDto extends createZodDto(SetChannelAgentSchema) {}
export class IcebreakerDto extends createZodDto(IcebreakerSchema) {}
