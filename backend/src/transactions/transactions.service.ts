import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { UpdateTransactionDto } from './dto/update-transaction.dto.js';
import { TransactionQueryDto } from './dto/transaction-query.dto.js';
import { TransactionType } from '../generated/prisma/enums.js';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTransactionDto) {
    const account = await this.assertAccountActive(dto.accountId);
    await this.assertCategoryCompatible(dto.categoryId, dto.type);

    if (dto.currency !== account.currency) {
      throw new BadRequestException(
        'La conversion de divisa aun no esta disponible.',
      );
    }

    if (dto.externalId) {
      const existing = await this.prisma.transaction.findUnique({
        where: { externalId: dto.externalId },
      });
      if (existing) return existing;
    }

    const amount = new Prisma.Decimal(dto.amount);
    return this.prisma.transaction.create({
      data: {
        type: dto.type,
        amount,
        currency: dto.currency,
        accountAmount: amount,
        exchangeRate: new Prisma.Decimal(1),
        concept: dto.concept,
        date: new Date(dto.date),
        notes: dto.notes,
        source: dto.source,
        externalId: dto.externalId,
        accountId: dto.accountId,
        categoryId: dto.categoryId,
      },
    });
  }

  async findAll(query: TransactionQueryDto) {
    const { from, to, categoryId, accountId, type, search, page, limit } = query;

    const where: Prisma.TransactionWhereInput = {
      ...(from || to
        ? {
            date: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to) }),
            },
          }
        : {}),
      ...(categoryId && { categoryId }),
      ...(accountId && { accountId }),
      ...(type && { type }),
      ...(search && { concept: { contains: search, mode: 'insensitive' } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  findOne(id: string) {
    return this.prisma.transaction.findUniqueOrThrow({ where: { id } });
  }

  async update(id: string, dto: UpdateTransactionDto) {
    const current = await this.prisma.transaction.findUniqueOrThrow({
      where: { id },
    });

    if (current.transferId) {
      throw new ConflictException(
        'No se puede editar un movimiento de una transferencia.',
      );
    }

    const accountId = dto.accountId ?? current.accountId;
    const categoryId = dto.categoryId ?? current.categoryId;
    const type = dto.type ?? current.type;
    const currency = dto.currency ?? current.currency;

    const account = await this.assertAccountActive(accountId);
    await this.assertCategoryCompatible(categoryId, type);
    if (currency !== account.currency) {
      throw new BadRequestException(
        'La conversion de divisa aun no esta disponible.',
      );
    }

    const data: Prisma.TransactionUncheckedUpdateInput = {};
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.concept !== undefined) data.concept = dto.concept;
    if (dto.date !== undefined) data.date = new Date(dto.date);
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.accountId !== undefined) data.accountId = dto.accountId;
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.amount !== undefined) {
      const amount = new Prisma.Decimal(dto.amount);
      data.amount = amount;
      data.accountAmount = amount;
    }

    return this.prisma.transaction.update({ where: { id }, data });
  }

  async remove(id: string) {
    const transaction = await this.prisma.transaction.findUniqueOrThrow({
      where: { id },
    });
    if (transaction.transferId) {
      throw new ConflictException(
        'No se puede borrar un movimiento de una transferencia.',
      );
    }
    return this.prisma.transaction.delete({ where: { id } });
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

  private async assertCategoryCompatible(
    categoryId: string | null,
    type: TransactionType,
  ) {
    if (!categoryId) {
      throw new BadRequestException('La categoria es obligatoria.');
    }
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.isArchived) {
      throw new BadRequestException('Categoria no valida o archivada.');
    }
    if (category.type !== 'BOTH' && category.type !== type) {
      throw new BadRequestException(
        'La categoria no es compatible con el tipo de movimiento.',
      );
    }
    return category;
  }
}
