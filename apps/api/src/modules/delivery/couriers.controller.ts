// 06 "Delivery" + §8.5 — courier accounts (DLV-03). Reads `delivery.send` (the send dialog lists the couriers for every
// member); writes, test and delete `delivery.manage` (Admin+) — 01-nest-module-map §3.2. Changes are audited.
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import type { ZodObject, ZodRawShape } from 'zod';
import { CreateCourierAccountSchema, UpdateCourierAccountSchema, type CreateCourierAccountInput } from '@djaber/shared';
import { RequirePermission } from '../../core/auth/decorators';
import { CourierAccountService } from './courier-account.service';

// a discriminated union: nestjs-zod validates any schema, the cast only satisfies the class typing
class CreateCourierAccountDto extends createZodDto(CreateCourierAccountSchema as unknown as ZodObject<ZodRawShape>) {}
class UpdateCourierAccountDto extends createZodDto(UpdateCourierAccountSchema) {}
const Id = () => Param('id', ParseUUIDPipe);

@Controller('delivery/couriers')
export class CouriersController {
  constructor(private readonly accounts: CourierAccountService) {}

  /** Provider catalogue of the add dialog (per-provider required fields, capabilities, label source). */
  @Get('providers')
  @RequirePermission('delivery.send')
  providers() {
    return this.accounts.providers();
  }

  @Get()
  @RequirePermission('delivery.send')
  list() {
    return this.accounts.list();
  }

  /** The body is validated by the provider's own schema (discriminated union on `provider`). */
  @Post()
  @RequirePermission('delivery.manage')
  create(@Body() dto: CreateCourierAccountDto) {
    return this.accounts.create(dto as unknown as CreateCourierAccountInput);
  }

  @Get(':id')
  @RequirePermission('delivery.send')
  get(@Id() id: string) {
    return this.accounts.get(id);
  }

  @Get(':id/capabilities')
  @RequirePermission('delivery.manage')
  capabilities(@Id() id: string) {
    return this.accounts.capabilities(id);
  }

  @Patch(':id')
  @RequirePermission('delivery.manage')
  update(@Id() id: string, @Body() dto: UpdateCourierAccountDto) {
    return this.accounts.update(id, dto);
  }

  /** 409 COURIER_HAS_ACTIVE_SHIPMENTS {count} while parcels are in flight ("Désactiver" instead). */
  @Delete(':id')
  @RequirePermission('delivery.manage')
  remove(@Id() id: string) {
    return this.accounts.remove(id);
  }

  /** Connection test (testing → ok + latency / rejected / unreachable) — the one synchronous courier call. */
  @Post(':id/test')
  @HttpCode(200)
  @RequirePermission('delivery.manage')
  test(@Id() id: string) {
    return this.accounts.test(id);
  }
}
