import { Test } from '@nestjs/testing';
import { DashboardService } from './dashboard.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { Currency } from '../generated/prisma/enums.js';

describe('DashboardService', () => {
  let service: DashboardService;
  const prisma = {
    transaction: { groupBy: vi.fn() },
    category: { findMany: vi.fn() },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [DashboardService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(DashboardService);
  });

  it('devuelve ceros cuando no hay movimientos', async () => {
    prisma.transaction.groupBy.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);

    const result = await service.get({ currency: Currency.EUR });

    expect(result).toEqual({
      from: null,
      to: null,
      currency: Currency.EUR,
      income: '0',
      expense: '0',
      balance: '0',
      count: 0,
      byCategory: [],
    });
    expect(prisma.category.findMany).not.toHaveBeenCalled();
  });

  it('calcula income, expense, balance y count', async () => {
    prisma.transaction.groupBy
      .mockResolvedValueOnce([
        { type: 'INCOME', _sum: { accountAmount: new Prisma.Decimal('1500') }, _count: { _all: 2 } },
        { type: 'EXPENSE', _sum: { accountAmount: new Prisma.Decimal('500') }, _count: { _all: 5 } },
      ])
      .mockResolvedValueOnce([]);
    prisma.category.findMany.mockResolvedValue([]);

    const result = await service.get({ currency: Currency.EUR });

    expect(result.income).toBe('1500');
    expect(result.expense).toBe('500');
    expect(result.balance).toBe('1000');
    expect(result.count).toBe(7);
  });

  it('calcula un balance negativo cuando los gastos superan a los ingresos', async () => {
    prisma.transaction.groupBy
      .mockResolvedValueOnce([
        { type: 'INCOME', _sum: { accountAmount: new Prisma.Decimal('100') }, _count: { _all: 1 } },
        { type: 'EXPENSE', _sum: { accountAmount: new Prisma.Decimal('250') }, _count: { _all: 3 } },
      ])
      .mockResolvedValueOnce([]);
    prisma.category.findMany.mockResolvedValue([]);

    const result = await service.get({ currency: Currency.EUR });

    expect(result.balance).toBe('-150');
    expect(result.count).toBe(4);
  });

  it('agrupa los gastos por categoría con su nombre', async () => {
    prisma.transaction.groupBy
      .mockResolvedValueOnce([
        { type: 'EXPENSE', _sum: { accountAmount: new Prisma.Decimal('120') }, _count: { _all: 3 } },
      ])
      .mockResolvedValueOnce([
        { categoryId: 'cat1', _sum: { accountAmount: new Prisma.Decimal('120') } },
      ]);
    prisma.category.findMany.mockResolvedValue([{ id: 'cat1', name: 'Alimentación' }]);

    const result = await service.get({ currency: Currency.EUR });

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

  it('aplica los filtros de transferencia, moneda y fecha', async () => {
    prisma.transaction.groupBy.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);

    await service.get({
      currency: Currency.USD,
      from: '2026-09-01',
      to: '2026-09-30',
    });

    expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          transferId: null,
          currency: Currency.USD,
          date: { gte: new Date('2026-09-01'), lte: new Date('2026-09-30') },
        },
      }),
    );
  });

  it('aplica solo el filtro from', async () => {
    prisma.transaction.groupBy.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);

    await service.get({ currency: Currency.EUR, from: '2026-09-01' });

    expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          transferId: null,
          currency: Currency.EUR,
          date: { gte: new Date('2026-09-01') },
        },
      }),
    );
  });

  it('aplica solo el filtro to', async () => {
    prisma.transaction.groupBy.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);

    await service.get({ currency: Currency.EUR, to: '2026-09-30' });

    expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          transferId: null,
          currency: Currency.EUR,
          date: { lte: new Date('2026-09-30') },
        },
      }),
    );
  });
});