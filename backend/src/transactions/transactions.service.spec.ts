import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TransactionsService } from './transactions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  CategoryType,
  Currency,
  TransactionSource,
  TransactionType,
} from '../generated/prisma/enums.js';

describe('TransactionsService', () => {
  let service: TransactionsService;
  const prisma = {
    account: { findUnique: vi.fn() },
    category: { findUnique: vi.fn() },
    transaction: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(TransactionsService);
  });

  describe('create', () => {
    it('crea un gasto en la misma moneda con exchangeRate 1', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc1',
        currency: Currency.EUR,
        isArchived: false,
      });
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat1',
        type: CategoryType.EXPENSE,
        isArchived: false,
      });
      const creada = {
        id: 't1',
        type: TransactionType.EXPENSE,
        amount: new Prisma.Decimal('23.4'),
        currency: Currency.EUR,
        accountAmount: new Prisma.Decimal('23.4'),
        exchangeRate: new Prisma.Decimal('1'),
        concept: 'Compra',
        date: new Date('2026-09-25'),
      };
      prisma.transaction.create.mockResolvedValue(creada);

      const result = await service.create({
        type: TransactionType.EXPENSE,
        amount: 23.4,
        currency: Currency.EUR,
        concept: 'Compra',
        date: '2026-09-25',
        categoryId: 'cat1',
        accountId: 'acc1',
        source: TransactionSource.WEB,
      });

      expect(result).toEqual(creada);
      const args = prisma.transaction.create.mock.calls[0][0];
      expect(args.data.accountAmount.toString()).toBe('23.4');
      expect(args.data.exchangeRate.toString()).toBe('1');
      expect(args.data.concept).toBe('Compra');
      expect(args.data.accountId).toBe('acc1');
      expect(args.data.categoryId).toBe('cat1');
    });
  });

  describe('create (validaciones)', () => {
    const baseDto = {
      type: TransactionType.EXPENSE,
      amount: 23.4,
      currency: Currency.EUR,
      concept: 'Compra',
      date: '2026-09-25',
      categoryId: 'cat1',
      accountId: 'acc1',
      source: TransactionSource.WEB,
    };

    it('rechaza una cuenta inexistente o archivada', async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(service.create(baseDto)).rejects.toThrow(BadRequestException);
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('rechaza una categoría archivada', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc1',
        currency: Currency.EUR,
        isArchived: false,
      });
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat1',
        type: CategoryType.EXPENSE,
        isArchived: true,
      });

      await expect(service.create(baseDto)).rejects.toThrow(BadRequestException);
    });

    it('rechaza una categoría incompatible con el tipo', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc1',
        currency: Currency.EUR,
        isArchived: false,
      });
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat1',
        type: CategoryType.INCOME,
        isArchived: false,
      });

      await expect(service.create(baseDto)).rejects.toThrow(BadRequestException);
    });

    it('acepta categoría BOTH para un ingreso', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc1',
        currency: Currency.EUR,
        isArchived: false,
      });
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat1',
        type: CategoryType.BOTH,
        isArchived: false,
      });
      prisma.transaction.create.mockResolvedValue({ id: 't1' });

      await expect(
        service.create({ ...baseDto, type: TransactionType.INCOME }),
      ).resolves.toEqual({ id: 't1' });
    });

    it('rechaza moneda distinta a la de la cuenta', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc1',
        currency: Currency.USD,
        isArchived: false,
      });
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat1',
        type: CategoryType.EXPENSE,
        isArchived: false,
      });

      await expect(service.create(baseDto)).rejects.toThrow(BadRequestException);
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('devuelve el existente si el externalId ya existe (idempotencia)', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc1',
        currency: Currency.EUR,
        isArchived: false,
      });
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat1',
        type: CategoryType.EXPENSE,
        isArchived: false,
      });
      const existente = { id: 't9', externalId: 'ticket-1' };
      prisma.transaction.findUnique.mockResolvedValue(existente);

      const result = await service.create({
        ...baseDto,
        source: TransactionSource.OPENCLAW,
        externalId: 'ticket-1',
      });

      expect(result).toEqual(existente);
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('devuelve los movimientos paginados con where vacío', async () => {
      prisma.transaction.findMany.mockResolvedValue([{ id: 't1' }]);
      prisma.transaction.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { date: 'desc' },
      });
      expect(result).toEqual({
        data: [{ id: 't1' }],
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it('aplica los filtros de fecha, categoría, tipo y búsqueda', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      await service.findAll({
        page: 2,
        limit: 10,
        from: '2026-09-01',
        to: '2026-09-30',
        categoryId: 'c1',
        type: TransactionType.EXPENSE,
        search: 'mercado',
      });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith({
        where: {
          date: { gte: new Date('2026-09-01'), lte: new Date('2026-09-30') },
          categoryId: 'c1',
          type: TransactionType.EXPENSE,
          concept: { contains: 'mercado', mode: 'insensitive' },
        },
        skip: 10,
        take: 10,
        orderBy: { date: 'desc' },
      });
    });

    it('aplica solo el filtro from', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 20, from: '2026-09-01' });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith({
        where: { date: { gte: new Date('2026-09-01') } },
        skip: 0,
        take: 20,
        orderBy: { date: 'desc' },
      });
    });

    it('aplica solo el filtro to', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 20, to: '2026-09-30' });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith({
        where: { date: { lte: new Date('2026-09-30') } },
        skip: 0,
        take: 20,
        orderBy: { date: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('devuelve el movimiento indicado', async () => {
      const movimiento = { id: 't1', concept: 'Compra' };
      prisma.transaction.findUniqueOrThrow.mockResolvedValue(movimiento);

      const result = await service.findOne('t1');

      expect(prisma.transaction.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 't1' },
      });
      expect(result).toEqual(movimiento);
    });
  });

  describe('update', () => {
    const current = {
      id: 't1',
      accountId: 'acc1',
      categoryId: 'cat1',
      type: TransactionType.EXPENSE,
      currency: Currency.EUR,
    };

    it('actualiza importe y concepto, recalculando accountAmount', async () => {
      prisma.transaction.findUniqueOrThrow.mockResolvedValue(current);
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc1',
        currency: Currency.EUR,
        isArchived: false,
      });
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat1',
        type: CategoryType.EXPENSE,
        isArchived: false,
      });
      const actualizada = { id: 't1', concept: 'Nueva' };
      prisma.transaction.update.mockResolvedValue(actualizada);

      const result = await service.update('t1', {
        amount: 50,
        concept: 'Nueva',
      });

      expect(result).toEqual(actualizada);
      const args = prisma.transaction.update.mock.calls[0][0];
      expect(args.where).toEqual({ id: 't1' });
      expect(args.data.amount.toString()).toBe('50');
      expect(args.data.accountAmount.toString()).toBe('50');
      expect(args.data.concept).toBe('Nueva');
    });

    it('rechaza cambiar a una categoría incompatible con el tipo', async () => {
      prisma.transaction.findUniqueOrThrow.mockResolvedValue(current);
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc1',
        currency: Currency.EUR,
        isArchived: false,
      });
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat2',
        type: CategoryType.INCOME,
        isArchived: false,
      });

      await expect(
        service.update('t1', { categoryId: 'cat2' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.transaction.update).not.toHaveBeenCalled();
    });

    it('rechaza cambiar a una moneda distinta a la de la cuenta', async () => {
      prisma.transaction.findUniqueOrThrow.mockResolvedValue(current);
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc1',
        currency: Currency.EUR,
        isArchived: false,
      });
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat1',
        type: CategoryType.EXPENSE,
        isArchived: false,
      });

      await expect(
        service.update('t1', { currency: Currency.USD }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.transaction.update).not.toHaveBeenCalled();
    });

    it('permite cambiar de cuenta validando la nueva', async () => {
      prisma.transaction.findUniqueOrThrow.mockResolvedValue(current);
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc2',
        currency: Currency.EUR,
        isArchived: false,
      });
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat1',
        type: CategoryType.EXPENSE,
        isArchived: false,
      });
      prisma.transaction.update.mockResolvedValue({ id: 't1' });

      await service.update('t1', { accountId: 'acc2' });

      const args = prisma.transaction.update.mock.calls[0][0];
      expect(args.data.accountId).toBe('acc2');
    });

    it('permite cambiar el tipo si la categoría es BOTH', async () => {
      prisma.transaction.findUniqueOrThrow.mockResolvedValue({
        ...current,
        categoryId: 'catBoth',
      });
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc1',
        currency: Currency.EUR,
        isArchived: false,
      });
      prisma.category.findUnique.mockResolvedValue({
        id: 'catBoth',
        type: CategoryType.BOTH,
        isArchived: false,
      });
      prisma.transaction.update.mockResolvedValue({ id: 't1' });

      await service.update('t1', { type: TransactionType.INCOME });

      const args = prisma.transaction.update.mock.calls[0][0];
      expect(args.data.type).toBe(TransactionType.INCOME);
    });

    it('rechaza editar un movimiento de una transferencia', async () => {
      prisma.transaction.findUniqueOrThrow.mockResolvedValue({
        ...current,
        transferId: 'tr1',
      });

      await expect(service.update('t1', { concept: 'x' })).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.transaction.update).not.toHaveBeenCalled();
    });

    it('actualiza sin cambios si el cuerpo está vacío', async () => {
      prisma.transaction.findUniqueOrThrow.mockResolvedValue(current);
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc1',
        currency: Currency.EUR,
        isArchived: false,
      });
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat1',
        type: CategoryType.EXPENSE,
        isArchived: false,
      });
      prisma.transaction.update.mockResolvedValue({ id: 't1' });

      await service.update('t1', {});

      const args = prisma.transaction.update.mock.calls[0][0];
      expect(args.data).toEqual({});
    });
  });

  describe('remove', () => {
    it('borra un movimiento normal', async () => {
      prisma.transaction.findUniqueOrThrow.mockResolvedValue({
        id: 't1',
        transferId: null,
      });
      const borrada = { id: 't1' };
      prisma.transaction.delete.mockResolvedValue(borrada);

      const result = await service.remove('t1');

      expect(prisma.transaction.delete).toHaveBeenCalledWith({
        where: { id: 't1' },
      });
      expect(result).toEqual(borrada);
    });

    it('rechaza borrar un movimiento de una transferencia', async () => {
      prisma.transaction.findUniqueOrThrow.mockResolvedValue({
        id: 't1',
        transferId: 'tr1',
      });

      await expect(service.remove('t1')).rejects.toThrow(ConflictException);
      expect(prisma.transaction.delete).not.toHaveBeenCalled();
    });
  });
});