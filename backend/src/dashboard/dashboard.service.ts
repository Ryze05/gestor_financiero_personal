import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { DashboardQueryDto } from './dto/dashboard-query.dto.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(query: DashboardQueryDto) {
    const { accountId, from, to } = query;

    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) {
      throw new NotFoundException('Cuenta no encontrada.');
    }

    const where: Prisma.TransactionWhereInput = {
      transferId: null,
      accountId,
      currency: account.currency,
      ...(from || to
        ? {
            date: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to) }),
            },
          }
        : {}),
    };

    const [typeGroups, categoryGroups] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['type'],
        where,
        _sum: { accountAmount: true },
        _count: { _all: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['categoryId'],
        where: { ...where, type: 'EXPENSE' },
        _sum: { accountAmount: true },
      }),
    ]);

    let income = new Prisma.Decimal(0);
    let expense = new Prisma.Decimal(0);
    let count = 0;
    for (const group of typeGroups) {
      const sum = group._sum.accountAmount ?? new Prisma.Decimal(0);
      if (group.type === 'INCOME') {
        income = income.plus(sum);
      } else {
        expense = expense.plus(sum);
      }
      count += group._count._all;
    }

    const categoryIds = categoryGroups
      .map((g) => g.categoryId)
      .filter((id): id is string => id !== null);

    const categories = categoryIds.length
      ? await this.prisma.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        })
      : [];

    const nameById = new Map(categories.map((c) => [c.id, c.name]));

    const byCategory = categoryGroups.map((group) => ({
      categoryId: group.categoryId,
      name: group.categoryId ? nameById.get(group.categoryId) ?? null : null,
      total: (group._sum.accountAmount ?? new Prisma.Decimal(0)).toString(),
    }));

    return {
      from: from ?? null,
      to: to ?? null,
      currency: account.currency,
      income: income.toString(),
      expense: expense.toString(),
      balance: income.minus(expense).toString(),
      count,
      byCategory,
    };
  }
}