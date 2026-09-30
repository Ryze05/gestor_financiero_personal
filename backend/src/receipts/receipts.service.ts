import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { CreateReceiptDto } from './dto/create-receipt.dto.js';
import { UpdateReceiptDto } from './dto/update-receipt.dto.js';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service.js';
import { TransactionType } from '../generated/prisma/enums.js';

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exchangeRate: ExchangeRateService,
  ) {}

  async create(dto: CreateReceiptDto) {
    const linesTotal = dto.lines.reduce(
      (total, line) => total.plus(new Prisma.Decimal(line.amount)),
      new Prisma.Decimal(0),
    );
    if (!linesTotal.equals(new Prisma.Decimal(dto.total))) {
      throw new BadRequestException(
        'El total del ticket no coincide con la suma de sus líneas.',
      );
    }

    const existing = await this.prisma.receipt.findUnique({
      where: { externalId: dto.externalId },
      include: { transactions: { include: { account: true, category: true } } },
    });
    if (existing) {
      return { receipt: existing, transactions: existing.transactions };
    }

    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId },
    });
    if (!account || account.isArchived) {
      throw new BadRequestException('Cuenta no valida o archivada.');
    }

    const receipts = await this.prisma.$transaction(async (p) => {
      const receipt = await p.receipt.create({
        data: {
          externalId: dto.externalId,
          merchant: dto.merchant,
          date: new Date(dto.date),
          total: new Prisma.Decimal(dto.total),
          currency: dto.currency,
          accountId: dto.accountId,
          source: dto.source,
        },
      });

      const transactions = [];
      for (const line of dto.lines) {
        const category = await p.category.findUnique({
          where: { id: line.categoryId },
        });
        if (!category || category.isArchived) {
          throw new BadRequestException(
            `Categoria no valida o archivada: ${line.categoryId}`,
          );
        }
        if (category.type !== 'BOTH' && category.type !== TransactionType.EXPENSE) {
          throw new BadRequestException(
            `La categoria '${category.name}' no es compatible con gastos de ticket.`,
          );
        }

        const amount = new Prisma.Decimal(line.amount);
        let accountAmount = amount;
        let exchangeRate = new Prisma.Decimal(1);
        if (dto.currency !== account.currency) {
          const rate = await this.exchangeRate.getRate(
            dto.currency,
            account.currency,
          );
          accountAmount = this.exchangeRate.convert(amount, rate);
          exchangeRate = rate;
        }

        const transaction = await p.transaction.create({
          data: {
            type: TransactionType.EXPENSE,
            amount,
            currency: dto.currency,
            accountAmount,
            exchangeRate,
            concept: line.concept,
            date: new Date(dto.date),
            source: dto.source,
            accountId: dto.accountId,
            categoryId: line.categoryId,
            receiptId: receipt.id,
          },
          include: { account: true, category: true },
        });
        transactions.push(transaction);
      }

      return { receipt, transactions };
    });

    return receipts;
  }

  async update(id: string, dto: UpdateReceiptDto) {
    const current = await this.prisma.receipt.findUniqueOrThrow({
      where: { id },
      include: { transactions: true },
    });

    if (dto.lines || dto.total !== undefined) {
      const expectedTotal = new Prisma.Decimal(
        dto.total ?? current.total,
      );
      const linesTotal = (dto.lines ?? current.transactions).reduce(
        (total, line) => total.plus(new Prisma.Decimal(line.amount)),
        new Prisma.Decimal(0),
      );
      if (!linesTotal.equals(expectedTotal)) {
        throw new BadRequestException(
          'El total del ticket no coincide con la suma de sus líneas.',
        );
      }
    }

    const accountId = dto.accountId ?? current.accountId;
    const currency = dto.currency ?? current.currency;
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account || account.isArchived) {
      throw new BadRequestException('Cuenta no valida o archivada.');
    }

    await this.prisma.$transaction(async (p) => {
      const data: Prisma.ReceiptUncheckedUpdateInput = {};
      if (dto.merchant !== undefined) data.merchant = dto.merchant;
      if (dto.date !== undefined) data.date = new Date(dto.date);
      if (dto.total !== undefined) data.total = new Prisma.Decimal(dto.total);
      if (dto.currency !== undefined) data.currency = dto.currency;
      if (dto.accountId !== undefined) data.accountId = dto.accountId;
      await p.receipt.update({ where: { id }, data });

      if (dto.lines) {
        await p.transaction.deleteMany({ where: { receiptId: id } });
        const date = dto.date ? new Date(dto.date) : current.date;
        for (const line of dto.lines) {
          const category = await p.category.findUnique({
            where: { id: line.categoryId },
          });
          if (!category || category.isArchived) {
            throw new BadRequestException(
              `Categoria no valida o archivada: ${line.categoryId}`,
            );
          }
          if (
            category.type !== 'BOTH' &&
            category.type !== TransactionType.EXPENSE
          ) {
            throw new BadRequestException(
              `La categoria '${category.name}' no es compatible con gastos de ticket.`,
            );
          }
          const amount = new Prisma.Decimal(line.amount);
          let accountAmount = amount;
          let exchangeRate = new Prisma.Decimal(1);
          if (currency !== account.currency) {
            const rate = await this.exchangeRate.getRate(
              currency,
              account.currency,
            );
            accountAmount = this.exchangeRate.convert(amount, rate);
            exchangeRate = rate;
          }
          await p.transaction.create({
            data: {
              type: TransactionType.EXPENSE,
              amount,
              currency,
              accountAmount,
              exchangeRate,
              concept: line.concept,
              date,
              source: current.source,
              accountId,
              categoryId: line.categoryId,
              receiptId: id,
            },
          });
        }
      } else if (
        dto.accountId !== undefined ||
        dto.currency !== undefined
      ) {
        for (const tx of current.transactions) {
          let accountAmount = tx.amount;
          let exchangeRate = new Prisma.Decimal(1);
          if (currency !== account.currency) {
            const rate = await this.exchangeRate.getRate(
              currency,
              account.currency,
            );
            accountAmount = this.exchangeRate.convert(tx.amount, rate);
            exchangeRate = rate;
          }
          await p.transaction.update({
            where: { id: tx.id },
            data: {
              accountId,
              currency,
              accountAmount,
              exchangeRate,
            },
          });
        }
      }
    });

    return this.prisma.receipt.findUniqueOrThrow({
      where: { id },
      include: {
        transactions: { include: { account: true, category: true } },
      },
    });
  }

  async findAll(query: { page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [data, total] = await Promise.all([
      this.prisma.receipt.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          transactions: { include: { account: true, category: true } },
        },
      }),
      this.prisma.receipt.count(),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    return this.prisma.receipt.findUniqueOrThrow({
      where: { id },
      include: {
        transactions: { include: { account: true, category: true } },
      },
    });
  }

  async remove(id: string) {
    const receipt = await this.prisma.receipt.findUniqueOrThrow({
      where: { id },
    });
    return this.prisma.$transaction(async (p) => {
      await p.transaction.deleteMany({ where: { receiptId: receipt.id } });
      return p.receipt.delete({ where: { id } });
    });
  }
}
