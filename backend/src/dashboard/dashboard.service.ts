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
      accountId,
      ...(from || to
        ? {
            date: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to) }),
            },
          }
        : {}),
    };

    const [typeGroups, categoryGroups, timelineGroups] = await Promise.all([
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
      this.prisma.transaction.groupBy({
        by: ['date', 'type', 'transferId'],
        where,
        orderBy: { date: 'asc' },
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

    const timeline = new Map<
      string,
      {
        income: Prisma.Decimal;
        expense: Prisma.Decimal;
        transferIn: Prisma.Decimal;
        transferOut: Prisma.Decimal;
      }
    >();

    for (const group of timelineGroups) {
      const date = group.date.toISOString().slice(0, 10);
      const current = timeline.get(date) ?? {
        income: new Prisma.Decimal(0),
        expense: new Prisma.Decimal(0),
        transferIn: new Prisma.Decimal(0),
        transferOut: new Prisma.Decimal(0),
      };
      const total = group._sum.accountAmount ?? new Prisma.Decimal(0);

      if (group.transferId) {
        if (group.type === 'INCOME') {
          current.transferIn = current.transferIn.plus(total);
        } else {
          current.transferOut = current.transferOut.plus(total);
        }
      } else if (group.type === 'INCOME') {
        current.income = current.income.plus(total);
      } else {
        current.expense = current.expense.plus(total);
      }

      timeline.set(date, current);
    }

    const timelineSeries: {
      date: string;
      income: string;
      expense: string;
      transferIn: string;
      transferOut: string;
    }[] = [];

    const zero = () => ({
      income: new Prisma.Decimal(0),
      expense: new Prisma.Decimal(0),
      transferIn: new Prisma.Decimal(0),
      transferOut: new Prisma.Decimal(0),
    });

    const pushPoint = (
      date: string,
      values: {
        income: Prisma.Decimal;
        expense: Prisma.Decimal;
        transferIn: Prisma.Decimal;
        transferOut: Prisma.Decimal;
      },
    ) => {
      timelineSeries.push({
        date,
        income: values.income.toString(),
        expense: values.expense.toString(),
        transferIn: values.transferIn.toString(),
        transferOut: values.transferOut.toString(),
      });
    };

    if (from && to) {
      const start = new Date(`${from}T00:00:00Z`);
      const end = new Date(`${to}T00:00:00Z`);
      for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
        const date = new Date(t).toISOString().slice(0, 10);
        pushPoint(date, timeline.get(date) ?? zero());
      }
    } else {
      for (const [date, values] of timeline) {
        pushPoint(date, values);
      }
    }

    return {
      from: from ?? null,
      to: to ?? null,
      currency: account.currency,
      income: income.toString(),
      expense: expense.toString(),
      balance: account.initialBalance.plus(income).minus(expense).toString(),
      count,
      byCategory,
      timeline: timelineSeries,
    };
  }
}
