// The M5 binding of the AI order port (`ORDER_TOOLS`, modules/ai/tools/order-tools.ts): `create_order` and
// `cancel_order` of 04-ai-pipeline §4.2 run through the orders service (OrderEffects inside one transaction).
import { Injectable } from '@nestjs/common';
import type { CancellableOrder, CreateOrderRequest, OrderToolContext, OrderTools, ToolResult } from '../ai/tools/order-tools';
import { OrderWorkflowService } from './order-workflow.service';
import { OrderService } from './order.service';

@Injectable()
export class OrderToolsService implements OrderTools {
  readonly available = true;
  constructor(
    private readonly orders: OrderService,
    private readonly workflow: OrderWorkflowService,
  ) {}

  createOrder(ctx: OrderToolContext, req: CreateOrderRequest): Promise<ToolResult> {
    return this.orders.createFromAi(ctx, req);
  }

  cancelOrder(ctx: OrderToolContext, order: CancellableOrder, reason: string | null): Promise<ToolResult> {
    return this.workflow.cancelFromAi(ctx, order, reason);
  }
}
