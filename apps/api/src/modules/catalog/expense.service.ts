// GDS-09 / EXP-01 — product expenses (marketing, shipping, packaging, customs, storage, other), per unit sold or fixed.
import { Injectable } from '@nestjs/common';
import { prisma, TenantContext, type Prisma, type ProductExpense } from '@djaber/db';
import type { CreateProductExpenseInput } from '@djaber/shared';
import { notFound, validationError } from '../../core/errors/app.exception';
import { algiersDayStart } from '../../core/time/algiers';
import { action } from './catalog.util';

const view = (e: ProductExpense) => ({
  id: e.id,
  productId: e.productId,
  category: e.category,
  description: e.description,
  amount: e.amount,
  isPerUnit: e.isPerUnit,
  date: e.date.toISOString(),
  createdAt: e.createdAt.toISOString(),
  actions: [action('edit', 'catalog.write'), action('delete', 'catalog.write')],
});

/** `YYYY-MM-DD` (Africa/Algiers) → instant; not more than one day in the future (04 §2 "Dates"). */
const dateOf = (raw: string | undefined): Date | undefined => {
  if (raw === undefined) return undefined;
  const d = algiersDayStart(raw.slice(0, 10));
  if (Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 24 * 3600 * 1000) throw validationError({ date: 'validation.date' });
  return d;
};

@Injectable()
export class ExpenseService {
  private async product(productId: string) {
    const p = await prisma.product.findFirst({ where: { id: productId }, select: { id: true, deletedAt: true } });
    if (!p) throw notFound();
    return p;
  }

  /** `GET /products/:id/expenses` */
  async list(productId: string) {
    await this.product(productId);
    return (await prisma.productExpense.findMany({ where: { productId }, orderBy: [{ date: 'desc' }, { id: 'desc' }] })).map(view);
  }

  /** `POST /products/:id/expenses` */
  async create(productId: string, input: CreateProductExpenseInput) {
    const p = await this.product(productId);
    if (p.deletedAt) throw notFound();
    const row = await prisma.productExpense.create({
      data: {
        productId,
        category: input.category,
        description: input.description ?? null,
        amount: input.amount,
        isPerUnit: input.isPerUnit,
        date: dateOf(input.date) ?? new Date(),
        createdById: TenantContext.get().userId!,
      } as Prisma.ProductExpenseUncheckedCreateInput,
    });
    return view(row);
  }

  /** `PATCH /products/:id/expenses/:eid` */
  async update(productId: string, expenseId: string, input: Partial<CreateProductExpenseInput>) {
    const current = await prisma.productExpense.findFirst({ where: { id: expenseId, productId } });
    if (!current) throw notFound();
    const row = await prisma.productExpense.update({
      where: { id: expenseId },
      data: {
        category: input.category,
        description: input.description === undefined ? undefined : (input.description ?? null),
        amount: input.amount,
        isPerUnit: input.isPerUnit,
        date: dateOf(input.date),
      },
    });
    return view(row);
  }

  /** `DELETE /products/:id/expenses/:eid` */
  async remove(productId: string, expenseId: string) {
    const current = await prisma.productExpense.findFirst({ where: { id: expenseId, productId } });
    if (!current) throw notFound();
    await prisma.productExpense.delete({ where: { id: expenseId } });
  }
}
