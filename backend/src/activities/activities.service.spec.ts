import { Test } from '@nestjs/testing';
import { ActivitiesService } from './activities.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('ActivitiesService', () => {
  let service: ActivitiesService;
  const prisma = {
    receipt: { findMany: vi.fn() },
    transaction: { findMany: vi.fn() },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(ActivitiesService);
  });

  const baseQuery = { page: 1, limit: 20 };

  it('combina tickets y movimientos y ordena por fecha desc', async () => {
    prisma.receipt.findMany.mockResolvedValue([
      {
        date: new Date('2026-09-20'),
        createdAt: new Date('2026-09-20T08:00:00Z'),
        transactions: [{ id: 'l1' }],
      },
    ]);
    prisma.transaction.findMany.mockResolvedValue([
      {
        date: new Date('2026-09-25'),
        createdAt: new Date('2026-09-25T08:00:00Z'),
        id: 't1',
      },
    ]);

    const result = await service.findAll(baseQuery);

    expect(result.data).toHaveLength(2);
    expect(result.data[0].type).toBe('TRANSACTION'); // 25/09 primero
    expect(result.data[1].type).toBe('RECEIPT'); // 20/09 después
    expect(result.total).toBe(2);
  });

  it('un ticket incluye sus transacciones', async () => {
    prisma.receipt.findMany.mockResolvedValue([
      {
        date: new Date('2026-09-20'),
        createdAt: new Date('2026-09-20T08:00:00Z'),
        transactions: [{ id: 'a' }, { id: 'b' }],
      },
    ]);
    prisma.transaction.findMany.mockResolvedValue([]);

    const result = await service.findAll(baseQuery);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].type).toBe('RECEIPT');
    expect(result.data[0].transactions).toHaveLength(2);
  });

  it('onlyReceipts=true no carga movimientos sueltos', async () => {
    prisma.receipt.findMany.mockResolvedValue([]);
    const result = await service.findAll({ ...baseQuery, onlyReceipts: true });

    expect(prisma.transaction.findMany).not.toHaveBeenCalled();
    expect(result.data).toHaveLength(0);
  });

  it('type=INCOME no carga tickets', async () => {
    prisma.receipt.findMany.mockResolvedValue([]);
    prisma.transaction.findMany.mockResolvedValue([]);

    await service.findAll({ ...baseQuery, type: 'INCOME' });

    expect(prisma.receipt.findMany).not.toHaveBeenCalled();
  });

  it('página correctamente las actividades', async () => {
    prisma.receipt.findMany.mockResolvedValue([
      {
        date: new Date('2026-09-18'),
        createdAt: new Date(),
        transactions: [],
      },
      {
        date: new Date('2026-09-19'),
        createdAt: new Date(),
        transactions: [],
      },
    ]);
    prisma.transaction.findMany.mockResolvedValue([
      {
        date: new Date('2026-09-20'),
        createdAt: new Date(),
        id: 't1',
      },
    ]);

    const result = await service.findAll({ page: 1, limit: 2 });

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(3);
  });

  it('aplica minAmount/maxAmount sobre el total del ticket', async () => {
    prisma.receipt.findMany.mockResolvedValue([]);
    prisma.transaction.findMany.mockResolvedValue([]);

    await service.findAll({ ...baseQuery, minAmount: 10, maxAmount: 50 });

    expect(prisma.receipt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          total: { gte: expect.any(Object), lte: expect.any(Object) },
        }),
      }),
    );
    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountAmount: { gte: expect.any(Object), lte: expect.any(Object) },
        }),
      }),
    );
  });

  it('aplica from/to sobre la fecha', async () => {
    prisma.receipt.findMany.mockResolvedValue([]);
    prisma.transaction.findMany.mockResolvedValue([]);

    await service.findAll({
      ...baseQuery,
      from: '2026-09-01',
      to: '2026-09-30',
    });

    expect(prisma.receipt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: { gte: new Date('2026-09-01'), lte: new Date('2026-09-30') },
        }),
      }),
    );
  });

  it('aplica source', async () => {
    prisma.receipt.findMany.mockResolvedValue([]);
    prisma.transaction.findMany.mockResolvedValue([]);

    await service.findAll({ ...baseQuery, source: 'OPENCLAW' });

    expect(prisma.receipt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ source: 'OPENCLAW' }),
      }),
    );
    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ source: 'OPENCLAW' }),
      }),
    );
  });

  it('desempata por createdAt cuando las fechas coinciden', async () => {
    prisma.receipt.findMany.mockResolvedValue([
      {
        date: new Date('2026-09-20'),
        createdAt: new Date('2026-09-20T08:00:00Z'),
        transactions: [],
      },
    ]);
    prisma.transaction.findMany.mockResolvedValue([
      {
        date: new Date('2026-09-20'),
        createdAt: new Date('2026-09-20T10:00:00Z'),
        id: 't1',
      },
    ]);

    const result = await service.findAll(baseQuery);

    // misma fecha: el más recién creado va primero
    expect(result.data[0].type).toBe('TRANSACTION');
    expect(result.data[1].type).toBe('RECEIPT');
  });
});