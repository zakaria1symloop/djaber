// Request DTOs of the channels module: shared zod schemas (packages/shared/src/schemas/channels.ts) wrapped for nestjs-zod.
import { createZodDto } from 'nestjs-zod';
import { ChannelEventsQuerySchema, ChannelsQuerySchema, EnableChannelSchema, SyncHistorySchema, UpdateChannelSchema } from '@djaber/shared';

export class ChannelsQueryDto extends createZodDto(ChannelsQuerySchema) {}
export class UpdateChannelDto extends createZodDto(UpdateChannelSchema) {}
export class EnableChannelDto extends createZodDto(EnableChannelSchema) {}
export class SyncHistoryDto extends createZodDto(SyncHistorySchema) {}
export class ChannelEventsQueryDto extends createZodDto(ChannelEventsQuerySchema) {}
