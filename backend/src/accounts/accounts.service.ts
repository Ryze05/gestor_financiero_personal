import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { CreateAccountDto } from './dto/create-account.dto.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAccountDto: CreateAccountDto) {
    const account = await this.prisma.account.create({
      data: {
        name: createAccountDto.name,
        initialBalance: new Prisma.Decimal(createAccountDto.initialBalance),
        currency: createAccountDto.currency,
      },
    });
    return { ...account, currentBalance: account.initialBalance };
  }

  async findAll(pagination: PaginationQueryDto) {
    const { page, limit } = pagination;
    const [accounts, total] = await Promise.all([
      this.prisma.account.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.account.count(),
    ]);

    const deltas = await this.computeBalanceDeltas(accounts.map((a) => a.id));
    const data = accounts.map((account) => ({
      ...account,
      currentBalance: account.initialBalance.plus(deltas.get(account.id) ?? 0),
    }));

    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const account = await this.prisma.account.findUniqueOrThrow({ where: { id } });
    const deltas = await this.computeBalanceDeltas([id]);
    return {
      ...account,
      currentBalance: account.initialBalance.plus(deltas.get(id) ?? 0),
    };
  }

  async update(id: string, updateAccountDto: UpdateAccountDto) {
    const data: Prisma.AccountUpdateInput = {};
    if (updateAccountDto.name !== undefined) {
      data.name = updateAccountDto.name;
    }
    if (updateAccountDto.initialBalance !== undefined) {
      data.initialBalance = new Prisma.Decimal(updateAccountDto.initialBalance);
    }

    const account = await this.prisma.account.update({ where: { id }, data });
    const deltas = await this.computeBalanceDeltas([id]);
    return {
      ...account,
      currentBalance: account.initialBalance.plus(deltas.get(id) ?? 0),
    };
  }

  async archive(id: string) {
    const account = await this.prisma.account.update({
      where: { id },
      data: { isArchived: true },
    });
    const deltas = await this.computeBalanceDeltas([id]);
    return {
      ...account,
      currentBalance: account.initialBalance.plus(deltas.get(id) ?? 0),
    };
  }

  async restore(id: string) {
    const account = await this.prisma.account.update({
      where: { id },
      data: { isArchived: false },
    });
    const deltas = await this.computeBalanceDeltas([id]);
    return {
      ...account,
      currentBalance: account.initialBalance.plus(deltas.get(id) ?? 0),
    };
  }

  private async computeBalanceDeltas(accountIds: string[]) {
    if (accountIds.length === 0) return new Map<string, Prisma.Decimal>();

    const groups = await this.prisma.transaction.groupBy({
      by: ['accountId', 'type'],
      where: { accountId: { in: accountIds } },
      _sum: { accountAmount: true },
    });

    const deltas = new Map<string, Prisma.Decimal>();
    for (const group of groups) {
      const current = deltas.get(group.accountId) ?? new Prisma.Decimal(0);
      const sum = group._sum.accountAmount ?? new Prisma.Decimal(0);
      deltas.set(
        group.accountId,
        group.type === 'INCOME' ? current.plus(sum) : current.minus(sum),
      );
    }
    return deltas;
  }
}
