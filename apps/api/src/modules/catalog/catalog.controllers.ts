// 06-api "Catalogue (GDS)" — categories, units, stock (adjustments, journal, dashboard, snapshot), moderation summary.
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Audited, Idempotent, RequirePermission } from '../../core/auth/decorators';
import { ExportService } from '../jobs/export.service';
import { CategoryService, UnitService } from './category.service';
import {
  CreateCategoryDto,
  CreateUnitDto,
  MovementsQueryDto,
  ReassignQueryDto,
  ReverseMovementDto,
  SnapshotQueryDto,
  StockAdjustmentDto,
  UpdateCategoryDto,
  UpdateUnitDto,
  type MovementsQuery,
  type SnapshotQuery,
} from './dto';
import { ModerationHookService } from './moderation-hook.service';
import { StockService } from './stock.service';

const Id = () => Param('id', ParseUUIDPipe);

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoryService) {}

  @Get()
  @RequirePermission('catalog.read')
  list() {
    return this.categories.list();
  }

  @Post()
  @RequirePermission('catalog.write')
  @Audited({ entity: 'Category', action: 'category.create', idFrom: 'result.id' })
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @RequirePermission('catalog.write')
  @Audited({ entity: 'Category', action: 'category.update' })
  update(@Id() id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('catalog.write')
  @HttpCode(204)
  @Audited({ entity: 'Category', action: 'category.delete' })
  async remove(@Id() id: string, @Query() q: ReassignQueryDto) {
    await this.categories.remove(id, q);
  }
}

@Controller('units')
export class UnitsController {
  constructor(private readonly units: UnitService) {}

  @Get()
  @RequirePermission('catalog.read')
  list() {
    return this.units.list();
  }

  @Post()
  @RequirePermission('catalog.write')
  @Audited({ entity: 'Unit', action: 'unit.create', idFrom: 'result.id' })
  create(@Body() dto: CreateUnitDto) {
    return this.units.create(dto);
  }

  @Patch(':id')
  @RequirePermission('catalog.write')
  @Audited({ entity: 'Unit', action: 'unit.update' })
  update(@Id() id: string, @Body() dto: UpdateUnitDto) {
    return this.units.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('catalog.write')
  @HttpCode(204)
  @Audited({ entity: 'Unit', action: 'unit.delete' })
  async remove(@Id() id: string, @Query() q: ReassignQueryDto) {
    await this.units.remove(id, q);
  }
}

@Controller('stock')
export class StockController {
  constructor(
    private readonly stock: StockService,
    private readonly exports: ExportService,
  ) {}

  /** GDS-01 — figures of the stock dashboard (simple / advanced by `Workspace.stockMode`) + the 10 last movements. */
  @Get('overview')
  @RequirePermission('catalog.read')
  overview() {
    return this.stock.overview();
  }

  /** CAT-05 — the only stock-adjustment endpoint (Idempotency-Key required, api-contract §1.7). */
  @Post('adjustments')
  @RequirePermission('stock.adjust')
  @Idempotent({ required: true })
  @Audited({ entity: 'StockMovement', action: 'stock.adjust', idFrom: 'result.id' })
  adjust(@Body() dto: StockAdjustmentDto) {
    return this.stock.adjust(dto);
  }

  @Get('movements')
  @RequirePermission('stock.read')
  movements(@Query() q: MovementsQueryDto) {
    return this.stock.listMovements(q as MovementsQuery);
  }

  @Get('movements/export')
  @RequirePermission('stock.read')
  @HttpCode(202)
  exportMovements(@Query() q: MovementsQueryDto) {
    const { page: _page, pageSize: _pageSize, view: _view, limit: _limit, format, ...filters } = q as MovementsQuery;
    return this.exports.request('movements', filters, format ?? 'xlsx');
  }

  @Get('movements/:id')
  @RequirePermission('stock.read')
  movement(@Id() id: string) {
    return this.stock.getMovement(id);
  }

  @Post('movements/:id/reverse')
  @RequirePermission('stock.adjust')
  @Audited({ entity: 'StockMovement', action: 'stock.reverse' })
  reverse(@Id() id: string, @Body() dto: ReverseMovementDto) {
    return this.stock.reverse(id, dto.note);
  }

  @Get('snapshot')
  @RequirePermission('stock.read')
  snapshot(@Query() q: SnapshotQueryDto) {
    return this.stock.snapshot(q as SnapshotQuery);
  }
}

@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderation: ModerationHookService) {}

  /** Banner "n produits en attente" (06 §8.2). */
  @Get('summary')
  @RequirePermission('catalog.read')
  summary() {
    return this.moderation.summary();
  }
}
