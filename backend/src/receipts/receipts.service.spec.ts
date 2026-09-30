import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ReceiptsService } from './receipts.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  CategoryType,
  Currency,
  TransactionSource,
  TransactionType,
} from '../generated/prisma/enums.js';

describe('ReceiptsService', () => {
  let service: ReceiptsService;
  const tx = {
    receipt: { create: vi.fn(), update: vi.fn() },
    category: { findUnique: vi.fn() },
    transaction: { create: vi.fn(), deleteMany: vi.fn(), update: vi.fn() },
  };
  const prisma = {
    receipt: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    account: { findUnique: vi.fn() },
    $transaction: vi.fn((cb: (p: typeof tx) => unknown) => cb(tx)),
  };
  const exchangeRate = {
    getRate: vi.fn(),
    convert: (amount: Prisma.Decimal, rate: Prisma.Decimal) =>
      amount.times(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ReceiptsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ExchangeRateService, useValue: exchangeRate },
      ],
    }).compile();

    service = module.get(ReceiptsService);
  });

  const baseDto = {
    externalId: 'ticket-001',
    merchant: 'Carrefour',
    date: '2026-09-25',
    total: 19,
    currency: Currency.EUR,
    accountId: 'acc1',
    source: TransactionSource.OPENCLAW,
    lines: [
      { amount: 7, concept: 'Camiseta', categoryId: 'catRopa' },
      { amount: 2, concept: 'Pan', categoryId: 'catAli' },
    ],
  };

  describe('create', () => {
    it('crea el receipt y una transacción por línea', async () => {
      prisma.receipt.findUnique.mockResolvedValue(null);
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc1',
        currency: Currency.EUR,
        isArchived: false,
      });
      tx.receipt.create.mockResolvedValue({ id: 'r1' });
      tx.category.findUnique.mockResolvedValue({
        id: 'catX',
        type: CategoryType.EXPENSE,
        isArchived: false,
        name: 'X',
      });
      tx.transaction.create.mockResolvedValue({ id: 'tX' });

      const result = await service.create(baseDto);

      expect(tx.receipt.create).toHaveBeenCalledTimes(1);
      expect(tx.transaction.create).toHaveBeenCalledTimes(2);
      expect(tx.transaction.create.mock.calls[0][0].data.receiptId).toBe('r1');
      expect(tx.transaction.create.mock.calls[0][0].data.type).toBe(
        TransactionType.EXPENSE,
      );
      expect(result).toEqual({
        receipt: { id: 'r1' },
        transactions: [{ id: 'tX' }, { id: 'tX' }],
      });
    });

    it('devuelve el existente sin duplicar si el externalId ya existe', async () => {
      const existente = { id: 'r1', transactions: [{ id: 't1' }] };
      prisma.receipt.findUnique.mockResolvedValue(existente);

      const result = await service.create(baseDto);

      expect(result).toEqual({
        receipt: existente,
        transactions: existente.transactions,
      });
      expect(prisma.account.findUnique).not.toHaveBeenCalled();
      expect(tx.receipt.create).not.toHaveBeenCalled();
    });

    it('rechaza una cuenta inexistente o archivada', async () => {
      prisma.receipt.findUnique.mockResolvedValue(null);
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(service.create(baseDto)).rejects.toThrow(BadRequestException);
    });

    it('rechaza una línea con categoría archivada', async () => {
      prisma.receipt.findUnique.mockResolvedValue(null);
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc1',
        currency: Currency.EUR,
        isArchived: false,
      });
      tx.receipt.create.mockResolvedValue({ id: 'r1' });
      tx.category.findUnique.mockResolvedValue({
        id: 'catX',
        type: CategoryType.EXPENSE,
        isArchived: true,
      });

      await expect(service.create(baseDto)).rejects.toThrow(BadRequestException);
    });

    it('rechaza una línea con categoría INCOME (no compatible con gastos)', async () => {
      prisma.receipt.findUnique.mockResolvedValue(null);
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc1',
        currency: Currency.EUR,
        isArchived: false,
      });
      tx.receipt.create.mockResolvedValue({ id: 'r1' });
      tx.category.findUnique.mockResolvedValue({
        id: 'catX',
        type: CategoryType.INCOME,
        isArchived: false,
        name: 'Salario',
      });

      await expect(service.create(baseDto)).rejects.toThrow(BadRequestException);
    });

    it('convierte la moneda por línea si difiere de la cuenta', async () => {
      prisma.receipt.findUnique.mockResolvedValue(null);
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc1',
        currency: Currency.EUR,
        isArchived: false,
      });
      tx.receipt.create.mockResolvedValue({ id: 'r1' });
      tx.category.findUnique.mockResolvedValue({
        id: 'catX',
        type: CategoryType.EXPENSE,
        isArchived: false,
        name: 'X',
      });
      tx.transaction.create.mockResolvedValue({ id: 'tX' });
      exchangeRate.getRate.mockResolvedValue(new Prisma.Decimal('0.9195'));

      await service.create({ ...baseDto, currency: Currency.USD });

      expect(exchangeRate.getRate).toHaveBeenCalledWith(Currency.USD, Currency.EUR);
      const args = tx.transaction.create.mock.calls[0][0];
      expect(args.data.amount.toString()).toBe('7');
      expect(args.data.currency).toBe(Currency.USD);
      expect(args.data.accountAmount.toString()).toBe('6.44');
      expect(args.data.exchangeRate.toString()).toBe('0.9195');
    });
  });

  describe('findAll', () => {
    it('devuelve receipts paginados', async () => {
      prisma.receipt.findMany.mockResolvedValue([{ id: 'r1' }]);
      prisma.receipt.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(prisma.receipt.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        orderBy: { date: 'desc' },
        include: {
          transactions: { include: { account: true, category: true } },
        },
      });
      expect(result).toEqual({
        data: [{ id: 'r1' }],
        total: 1,
        page: 1,
        limit: 20,
      });
    });
  });

  describe('findOne', () => {
    it('devuelve el receipt con sus movimientos', async () => {
      const receipt = { id: 'r1', transactions: [] };
      prisma.receipt.findUniqueOrThrow.mockResolvedValue(receipt);

      const result = await service.findOne('r1');

      expect(prisma.receipt.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 'r1' },
        include: {
          transactions: { include: { account: true, category: true } },
        },
      });
      expect(result).toEqual(receipt);
    });
  });

  describe('update', () => {
    const currentReceipt = {
      id: 'r1',
      accountId: 'acc1',
      currency: Currency.EUR,
      source: TransactionSource.WEB,
      date: new Date('2026-09-25'),
      transactions: [
        { id: 't1', amount: new Prisma.Decimal(10), currency: Currency.EUR },
      ],
    };

    it('actualiza los metadatos sin tocar las líneas', async () => {
      prisma.receipt.findUniqueOrThrow
        .mockResolvedValueOnce(currentReceipt)
        .mockResolvedValueOnce({ id: 'r1' });
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc1',
        currency: Currency.EUR,
        isArchived: false,
      });
      tx.receipt.update.mockResolvedValue({ id: 'r1' });

      await service.update('r1', { merchant: 'Alcampo', total: 20 });

      expect(tx.receipt.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { merchant: 'Alcampo', total: new Prisma.Decimal(20) },
      });
      expect(tx.transaction.deleteMany).not.toHaveBeenCalled();
      expect(tx.transaction.update).not.toHaveBeenCalled();
    });

    it('reemplaza las líneas cuando se envían', async () => {
      prisma.receipt.findUniqueOrThrow
        .mockResolvedValueOnce(currentReceipt)
        .mockResolvedValueOnce({ id: 'r1', transactions: [] });
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc1',
        currency: Currency.EUR,
        isArchived: false,
      });
      tx.receipt.update.mockResolvedValue({ id: 'r1' });
      tx.category.findUnique.mockResolvedValue({
        id: 'catAli',
        type: CategoryType.EXPENSE,
        isArchived: false,
        name: 'Alimentación',
      });
      tx.transaction.create.mockResolvedValue({ id: 'tNew' });

      await service.update('r1', {
        lines: [{ amount: 2, concept: 'Pan', categoryId: 'catAli' }],
      });

      expect(tx.transaction.deleteMany).toHaveBeenCalledWith({
        where: { receiptId: 'r1' },
      });
      expect(tx.transaction.create).toHaveBeenCalledTimes(1);
      const args = tx.transaction.create.mock.calls[0][0];
      expect(args.data.receiptId).toBe('r1');
      expect(args.data.source).toBe(TransactionSource.WEB);
    });

    it('propaga el cambio de cuenta/moneda a las líneas existentes', async () => {
      prisma.receipt.findUniqueOrThrow
        .mockResolvedValueOnce(currentReceipt)
        .mockResolvedValueOnce({ id: 'r1', transactions: [] });
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc2',
        currency: Currency.USD,
        isArchived: false,
      });
      tx.receipt.update.mockResolvedValue({ id: 'r1' });
      tx.transaction.update.mockResolvedValue({ id: 't1' });
      exchangeRate.getRate.mockResolvedValue(new Prisma.Decimal('1.1'));

      await service.update('r1', { accountId: 'acc2' });

      expect(exchangeRate.getRate).toHaveBeenCalledWith(
        Currency.EUR,
        Currency.USD,
      );
      expect(tx.transaction.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: expect.objectContaining({ accountId: 'acc2', currency: Currency.EUR }),
      });
      expect(tx.transaction.deleteMany).not.toHaveBeenCalled();
    });

    it('rechaza una cuenta no válida o archivada', async () => {
      prisma.receipt.findUniqueOrThrow.mockResolvedValueOnce(currentReceipt);
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(
        service.update('r1', { accountId: 'acc2' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza una línea con categoría no válida al reemplazar líneas', async () => {
      prisma.receipt.findUniqueOrThrow
        .mockResolvedValueOnce(currentReceipt)
        .mockResolvedValueOnce({ id: 'r1', transactions: [] });
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc1',
        currency: Currency.EUR,
        isArchived: false,
      });
      tx.receipt.update.mockResolvedValue({ id: 'r1' });
      tx.category.findUnique.mockResolvedValue({
        id: 'catX',
        type: CategoryType.INCOME,
        isArchived: false,
        name: 'Salario',
      });

      await expect(
        service.update('r1', {
          lines: [{ amount: 5, concept: 'X', categoryId: 'catX' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('borra los movimientos y el receipt de forma atómica', async () => {
      prisma.receipt.findUniqueOrThrow.mockResolvedValue({ id: 'r1' });
      tx.transaction.deleteMany.mockResolvedValue({ count: 3 });
      tx.receipt.delete = vi.fn().mockResolvedValue({ id: 'r1' });

      const result = await service.remove('r1');

      expect(tx.transaction.deleteMany).toHaveBeenCalledWith({
        where: { receiptId: 'r1' },
      });
      expect(tx.receipt.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
      expect(result).toEqual({ id: 'r1' });
    });
  });
});