import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { CreateTransferDto } from './dto/create-transfer.dto.js';
import { UpdateTransferDto } from './dto/update-transfer.dto.js';
import { TransferQueryDto } from './dto/transfer-query.dto.js';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service.js';

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exchangeRate: ExchangeRateService,
  ) {}

  async create(dto: CreateTransferDto) {
    const { sourceAccountId, destinationAccountId } = dto;

    if (sourceAccountId === destinationAccountId) {
      throw new BadRequestException('Las cuentas deben ser distintas.');
    }

    const [source, destination] = await Promise.all([
      this.assertAccountActive(sourceAccountId),
      this.assertAccountActive(destinationAccountId),
    ]);

    const amount = new Prisma.Decimal(dto.amount);
    const date = new Date(dto.date);
    const concept = dto.concept ?? 'Transferencia';

    let destinationAmount = amount;
    let exchangeRate = new Prisma.Decimal(1);
    if (source.currency !== destination.currency) {
      const rate = await this.exchangeRate.getRate(
        source.currency,
        destination.currency,
      );
      destinationAmount = this.exchangeRate.convert(amount, rate);
      exchangeRate = rate;
    }

    return this.prisma.$transaction(async (p) => {
      const transfer = await p.transfer.create({
        data: {
          amount,
          sourceCurrency: source.currency,
          destinationAmount,
          destinationCurrency: destination.currency,
          exchangeRate,
          date,
          concept,
          sourceAccountId,
          destinationAccountId,
        },
      });

      await p.transaction.create({
        data: {
          type: 'EXPENSE',
          amount,
          currency: source.currency,
          accountAmount: amount,
          exchangeRate: new Prisma.Decimal(1),
          concept,
          date,
          source: 'WEB',
          accountId: sourceAccountId,
          transferId: transfer.id,
        },
      });

      await p.transaction.create({
        data: {
          type: 'INCOME',
          amount: destinationAmount,
          currency: destination.currency,
          accountAmount: destinationAmount,
          exchangeRate: new Prisma.Decimal(1),
          concept,
          date,
          source: 'WEB',
          accountId: destinationAccountId,
          transferId: transfer.id,
        },
      });

      return p.transfer.findUniqueOrThrow({
        where: { id: transfer.id },
        include: { sourceAccount: true, destinationAccount: true },
      });
    });
  }

  async update(id: string, dto: UpdateTransferDto) {
    const existing = await this.prisma.transfer.findUniqueOrThrow({
      where: { id },
    });

    const sourceAccountId = dto.sourceAccountId ?? existing.sourceAccountId;
    const destinationAccountId =
      dto.destinationAccountId ?? existing.destinationAccountId;

    if (sourceAccountId === destinationAccountId) {
      throw new BadRequestException('Las cuentas deben ser distintas.');
    }

    const [source, destination] = await Promise.all([
      this.assertAccountActive(sourceAccountId),
      this.assertAccountActive(destinationAccountId),
    ]);

    const amount =
      dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : existing.amount;
    const date = dto.date !== undefined ? new Date(dto.date) : existing.date;
    const concept = dto.concept ?? existing.concept ?? 'Transferencia';

    let destinationAmount = existing.destinationAmount;
    let exchangeRate = existing.exchangeRate;

    const recompute =
      dto.amount !== undefined ||
      dto.sourceAccountId !== undefined ||
      dto.destinationAccountId !== undefined;

    if (recompute) {
      if (source.currency !== destination.currency) {
        const rate = await this.exchangeRate.getRate(
          source.currency,
          destination.currency,
        );
        destinationAmount = this.exchangeRate.convert(amount, rate);
        exchangeRate = rate;
      } else {
        destinationAmount = amount;
        exchangeRate = new Prisma.Decimal(1);
      }
    }

    return this.prisma.$transaction(async (p) => {
      const transfer = await p.transfer.update({
        where: { id },
        data: {
          amount,
          sourceCurrency: source.currency,
          destinationAmount,
          destinationCurrency: destination.currency,
          exchangeRate,
          date,
          concept,
          sourceAccountId,
          destinationAccountId,
        },
      });

      await p.transaction.updateMany({
        where: { transferId: id, type: 'EXPENSE' },
        data: {
          type: 'EXPENSE',
          amount,
          currency: source.currency,
          accountAmount: amount,
          exchangeRate: new Prisma.Decimal(1),
          concept,
          date,
          accountId: sourceAccountId,
        },
      });

      await p.transaction.updateMany({
        where: { transferId: id, type: 'INCOME' },
        data: {
          type: 'INCOME',
          amount: destinationAmount,
          currency: destination.currency,
          accountAmount: destinationAmount,
          exchangeRate: new Prisma.Decimal(1),
          concept,
          date,
          accountId: destinationAccountId,
        },
      });

      return p.transfer.findUniqueOrThrow({
        where: { id: transfer.id },
        include: { sourceAccount: true, destinationAccount: true },
      });
    });
  }

  async findAll(query: TransferQueryDto) {
    const { from, to, search, page, limit } = query;

    const where: Prisma.TransferWhereInput = {
      ...(from || to
        ? {
            date: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to) }),
            },
          }
        : {}),
      ...(search && { concept: { contains: search, mode: 'insensitive' } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.transfer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date: 'desc' },
        include: { sourceAccount: true, destinationAccount: true },
      }),
      this.prisma.transfer.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  findOne(id: string) {
    return this.prisma.transfer.findUniqueOrThrow({
      where: { id },
      include: {
        sourceAccount: true,
        destinationAccount: true,
        transactions: true,
      },
    });
  }

  remove(id: string) {
    // Deleting the transfer cascades to its two linked transactions.
    return this.prisma.transfer.delete({ where: { id } });
  }

  private async assertAccountActive(accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account || account.isArchived) {
      throw new BadRequestException('Cuenta no valida o archivada.');
    }
    return account;
  }
}
