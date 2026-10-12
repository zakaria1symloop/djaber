import { createZodDto } from 'nestjs-zod';
import { CreditsCalculatorQuerySchema, LedgerQuerySchema } from '@djaber/shared';

export class LedgerQueryDto extends createZodDto(LedgerQuerySchema) {}
export class CreditsCalculatorQueryDto extends createZodDto(CreditsCalculatorQuerySchema) {}
