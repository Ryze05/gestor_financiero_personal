import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DashboardService } from './dashboard.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { Currency } from '../generated/prisma/enums.js';

describe('DashboardService', () => {
  let service: DashboardService;
  const prisma = {
    account: { findUnique: vi.fn() },
    transaction: { groupBy: vi.fn() },
    category: { findMany: vi.fn() },
  };

  const ACC = 'acc1';

  const stubAccount = (
    currency: Currency = Currency.EUR,
    initialBalance = new Prisma.Decimal('0'),
  ) =>
    prisma.account.findUnique.mockResolvedValue({
      id: ACC,
      currency,
      isArchived: false,
      initialBalance,
    });

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [DashboardService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(DashboardService);
  });

  it('lanza NotFound cuando la cuenta no existe', async () => {
    prisma.account.findUnique.mockResolvedValue(null);

    await expect(service.get({ accountId: ACC })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.transaction.groupBy).not.toHaveBeenCalled();
  });

  it('devuelve ceros cuando no hay movimientos', async () => {
    stubAccount();
    prisma.transaction.groupBy.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);

    const result = await service.get({ accountId: ACC });

    expect(result).toEqual({
      from: null,
      to: null,
      currency: Currency.EUR,
      income: '0',
      expense: '0',
      openingBalance: '0',
      balance: '0',
      count: 0,
      byCategory: [],
      timeline: [],
    });
    expect(prisma.category.findMany).not.toHaveBeenCalled();
  });

  it('calcula income, expense, balance y count', async () => {
    stubAccount(Currency.EUR, new Prisma.Decimal('1000'));
    prisma.transaction.groupBy
      .mockResolvedValueOnce([
        { type: 'INCOME', _sum: { accountAmount: new Prisma.Decimal('1500') }, _count: { _all: 2 } },
        { type: 'EXPENSE', _sum: { accountAmount: new Prisma.Decimal('500') }, _count: { _all: 5 } },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prisma.category.findMany.mockResolvedValue([]);

    const result = await service.get({ accountId: ACC });

    expect(result.income).toBe('1500');
    expect(result.expense).toBe('500');
    expect(result.balance).toBe('2000');
    expect(result.count).toBe(7);
  });

  it('calcula un balance negativo cuando los gastos superan a los ingresos', async () => {
    stubAccount(Currency.EUR, new Prisma.Decimal('0'));
    prisma.transaction.groupBy
      .mockResolvedValueOnce([
        { type: 'INCOME', _sum: { accountAmount: new Prisma.Decimal('100') }, _count: { _all: 1 } },
        { type: 'EXPENSE', _sum: { accountAmount: new Prisma.Decimal('250') }, _count: { _all: 3 } },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prisma.category.findMany.mockResolvedValue([]);

    const result = await service.get({ accountId: ACC });

    expect(result.balance).toBe('-150');
    expect(result.count).toBe(4);
  });

  it('agrupa los gastos por categoría con su nombre', async () => {
    stubAccount();
    prisma.transaction.groupBy
      .mockResolvedValueOnce([
        { type: 'EXPENSE', _sum: { accountAmount: new Prisma.Decimal('120') }, _count: { _all: 3 } },
      ])
      .mockResolvedValueOnce([
        { categoryId: 'cat1', _sum: { accountAmount: new Prisma.Decimal('120') } },
      ])
      .mockResolvedValueOnce([]);
    prisma.category.findMany.mockResolvedValue([{ id: 'cat1', name: 'Alimentación' }]);

    const result = await service.get({ accountId: ACC });

    expect(result.byCategory).toEqual([
      { categoryId: 'cat1', name: 'Alimentación', total: '120' },
    ]);
    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['cat1'] } },
      select: { id: true, name: true },
    });

    const categoryCall = prisma.transaction.groupBy.mock.calls[1][0];
    expect(categoryCall.where).toEqual(expect.objectContaining({ type: 'EXPENSE' }));
  });

  it('agrupa ingresos, gastos y transferencias por fecha (rellenando días vacíos)', async () => {
    stubAccount(Currency.EUR);
    prisma.transaction.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          date: new Date('2026-09-15'),
          type: 'INCOME',
          transferId: null,
          _sum: { accountAmount: new Prisma.Decimal('1000') },
        },
        {
          date: new Date('2026-09-15'),
          type: 'EXPENSE',
          transferId: null,
          _sum: { accountAmount: new Prisma.Decimal('250') },
        },
        {
          date: new Date('2026-09-15'),
          type: 'EXPENSE',
          transferId: 'transfer-1',
          _sum: { accountAmount: new Prisma.Decimal('50') },
        },
      ]);
    prisma.category.findMany.mockResolvedValue([]);

    const result = await service.get({
      accountId: ACC,
      from: '2026-09-01',
      to: '2026-09-30',
    });

    expect(result.timeline).toHaveLength(30);
    expect(result.timeline[0]).toEqual({
      date: '2026-09-01',
      income: '0',
      expense: '0',
      transferIn: '0',
      transferOut: '0',
    });
    expect(result.timeline[14]).toEqual({
      date: '2026-09-15',
      income: '1000',
      expense: '250',
      transferIn: '0',
      transferOut: '50',
    });
    expect(result.timeline[29]).toEqual({
      date: '2026-09-30',
      income: '0',
      expense: '0',
      transferIn: '0',
      transferOut: '0',
    });
  });

  it('no rellena días cuando no hay rango de fechas', async () => {
    stubAccount(Currency.EUR);
    prisma.transaction.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          date: new Date('2026-09-15'),
          type: 'EXPENSE',
          transferId: null,
          _sum: { accountAmount: new Prisma.Decimal('120') },
        },
      ]);
    prisma.category.findMany.mockResolvedValue([]);

    const result = await service.get({ accountId: ACC });

    expect(result.timeline).toEqual([
      {
        date: '2026-09-15',
        income: '0',
        expense: '120',
        transferIn: '0',
        transferOut: '0',
      },
    ]);
  });

  it('filtra por cuenta y fecha', async () => {
    stubAccount(Currency.USD);
    prisma.transaction.groupBy.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);

    await service.get({
      accountId: ACC,
      from: '2026-09-01',
      to: '2026-09-30',
    });

    expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          accountId: ACC,
          date: { gte: new Date('2026-09-01'), lte: new Date('2026-09-30') },
        },
      }),
    );
  });

  it('aplica solo el filtro from', async () => {
    stubAccount();
    prisma.transaction.groupBy.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);

    await service.get({ accountId: ACC, from: '2026-09-01' });

    expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          accountId: ACC,
          date: { gte: new Date('2026-09-01') },
        },
      }),
    );
  });

  it('aplica solo el filtro to', async () => {
    stubAccount();
    prisma.transaction.groupBy.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);

    await service.get({ accountId: ACC, to: '2026-09-30' });

    expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          accountId: ACC,
          date: { lte: new Date('2026-09-30') },
        },
      }),
    );
  });
});
