import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { ActivityQueryDto } from './dto/activity-query.dto.js';

type ReceiptWithTransactions = Prisma.ReceiptGetPayload<{
  include: {
    account: true;
    transactions: { include: { account: true; category: true } };
  };
}>;

type TransactionWithRelations = Prisma.TransactionGetPayload<{
  include: { account: true; category: true };
}>;

export type Activity =
  | {
      type: 'RECEIPT';
      receipt: ReceiptWithTransactions;
      transactions: ReceiptWithTransactions['transactions'];
    }
  | {
      type: 'TRANSACTION';
      transaction: TransactionWithRelations;
  };

function matchesLineFilters(
  transaction: TransactionWithRelations,
  filters: {
    categoryId?: string;
    type?: string;
    minAmount?: number;
    maxAmount?: number;
    search?: string;
  },
) {
  if (filters.categoryId && transaction.categoryId !== filters.categoryId) {
    return false;
  }
  if (filters.type && transaction.type !== filters.type) return false;

  const amount = Number(transaction.accountAmount);
  if (filters.minAmount !== undefined && amount < filters.minAmount) {
    return false;
  }
  if (filters.maxAmount !== undefined && amount > filters.maxAmount) {
    return false;
  }
  if (
    filters.search &&
    !transaction.concept.toLowerCase().includes(filters.search.toLowerCase())
  ) {
    return false;
  }

  return true;
}

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ActivityQueryDto) {
    const {
      accountId,
      from,
      to,
      categoryId,
      type,
      source,
      search,
      minAmount,
      maxAmount,
      onlyReceipts,
      page,
      limit,
    } = query;

    let dateFilter: object = {};
    if (from || to) {
      dateFilter = {
        date: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      };
    }

    let amountFilter: object = {};
    if (minAmount !== undefined || maxAmount !== undefined) {
      amountFilter = {
        gte:
          minAmount !== undefined
            ? new Prisma.Decimal(minAmount)
            : undefined,
        lte:
          maxAmount !== undefined
            ? new Prisma.Decimal(maxAmount)
            : undefined,
      };
    }

    let receipts: ReceiptWithTransactions[] = [];
    if (type !== 'INCOME') {
      const lineWhere: Prisma.TransactionWhereInput = {
        ...(categoryId && { categoryId }),
        ...(type && { type }),
        ...(Object.keys(amountFilter).length
          ? { accountAmount: amountFilter }
          : {}),
      };
      const conceptWhere: Prisma.TransactionWhereInput = {
        ...lineWhere,
        ...(search && {
          concept: { contains: search, mode: 'insensitive' },
        }),
      };

      receipts = await this.prisma.receipt.findMany({
        where: {
          ...(accountId && { accountId }),
          ...(source && { source }),
          ...dateFilter,
          transactions: { some: lineWhere },
          ...(search && {
            OR: [
              { merchant: { contains: search, mode: 'insensitive' } },
              { transactions: { some: conceptWhere } },
            ],
          }),
        },
        include: {
          account: true,
          transactions: { include: { account: true, category: true } },
        },
      });
    }

    let transactions: TransactionWithRelations[] = [];
    if (!onlyReceipts) {
      transactions = await this.prisma.transaction.findMany({
        where: {
          receiptId: null,
          ...(accountId && { accountId }),
          ...(source && { source }),
          ...(type && { type }),
          ...(categoryId && { categoryId }),
          ...(search && {
            concept: { contains: search, mode: 'insensitive' },
          }),
          ...dateFilter,
          ...(Object.keys(amountFilter).length
            ? { accountAmount: amountFilter }
            : {}),
        },
        include: { account: true, category: true },
      });
    }

    const activities: Activity[] = [
      ...receipts.map((receipt) => {
        const merchantMatches = Boolean(
          search &&
            receipt.merchant?.toLowerCase().includes(search.toLowerCase()),
        );
        const filters = {
          categoryId,
          type,
          minAmount,
          maxAmount,
          ...(merchantMatches ? {} : { search }),
        };

        return {
          type: 'RECEIPT' as const,
          receipt,
          transactions: receipt.transactions.filter((transaction) =>
            matchesLineFilters(transaction, filters),
          ),
        };
      }),
      ...transactions.map((transaction) => ({
        type: 'TRANSACTION' as const,
        transaction,
      })),
    ];

    activities.sort((a, b) => {
      const dateA =
        a.type === 'RECEIPT' ? a.receipt.date : a.transaction.date;
      const dateB =
        b.type === 'RECEIPT' ? b.receipt.date : b.transaction.date;
      const byDate = dateB.getTime() - dateA.getTime();
      if (byDate !== 0) return byDate;
      const createdA =
        a.type === 'RECEIPT'
          ? a.receipt.createdAt
          : a.transaction.createdAt;
      const createdB =
        b.type === 'RECEIPT'
          ? b.receipt.createdAt
          : b.transaction.createdAt;
      return createdB.getTime() - createdA.getTime();
    });

    const total = activities.length;
    const data = activities.slice((page - 1) * limit, page * limit);

    return { data, total, page, limit };
  }
}
