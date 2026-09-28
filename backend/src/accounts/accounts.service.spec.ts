import { Test } from '@nestjs/testing';
import { AccountsService } from './accounts.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { Currency } from '../generated/prisma/enums.js';

describe('AccountsService', () => {
  let service: AccountsService;
  const prisma = {
    account: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    transaction: {
      groupBy: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AccountsService);
  });

  describe('findAll', () => {
    it('devuelve las cuentas paginadas con el saldo actual', async () => {
      const cuenta = {
        id: 'a1',
        name: 'Cuenta principal',
        initialBalance: new Prisma.Decimal('100'),
        currency: 'EUR',
        isArchived: false,
      };
      prisma.account.findMany.mockResolvedValue([cuenta]);
      prisma.account.count.mockResolvedValue(1);
      prisma.transaction.groupBy.mockResolvedValue([
        { accountId: 'a1', type: 'INCOME', _sum: { accountAmount: new Prisma.Decimal('50') } },
        { accountId: 'a1', type: 'EXPENSE', _sum: { accountAmount: new Prisma.Decimal('20') } },
      ]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.data[0].currentBalance.toString()).toBe('130');
    });

    it('incluye los movimientos de transferencia en el saldo actual', async () => {
      const cuenta = {
        id: 'a1',
        name: 'Cuenta principal',
        initialBalance: new Prisma.Decimal('100'),
        currency: 'EUR',
        isArchived: false,
      };
      prisma.account.findMany.mockResolvedValue([cuenta]);
      prisma.account.count.mockResolvedValue(1);
      prisma.transaction.groupBy.mockResolvedValue([
        { accountId: 'a1', type: 'EXPENSE', _sum: { accountAmount: new Prisma.Decimal('50') } },
      ]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { accountId: { in: ['a1'] } },
        }),
      );
      expect(result.data[0].currentBalance.toString()).toBe('50');
    });
  });

  describe('create', () => {
    it('crea una cuenta convirtiendo el saldo inicial a Decimal', async () => {
      const dto = { name: 'Ahorros', initialBalance: 1500.55, currency: Currency.USD };
      const creada = {
        id: 'a2',
        name: 'Ahorros',
        initialBalance: new Prisma.Decimal('1500.55'),
        currency: Currency.USD,
        isArchived: false,
      };
      prisma.account.create.mockResolvedValue(creada);

      const result = await service.create(dto);

      expect(prisma.account.create).toHaveBeenCalledOnce();
      const args = prisma.account.create.mock.calls[0][0];
      expect(args.data.name).toBe('Ahorros');
      expect(args.data.initialBalance.toString()).toBe('1500.55');
      expect(args.data.currency).toBe('USD');
      expect(result.currentBalance.toString()).toBe('1500.55');
    });
  });

  describe('findOne', () => {
    it('devuelve la cuenta con su saldo actual', async () => {
      const cuenta = {
        id: 'a1',
        name: 'Cuenta principal',
        initialBalance: new Prisma.Decimal('100'),
        currency: Currency.EUR,
        isArchived: false,
      };
      prisma.account.findUniqueOrThrow.mockResolvedValue(cuenta);
      prisma.transaction.groupBy.mockResolvedValue([
        { accountId: 'a1', type: 'INCOME', _sum: { accountAmount: new Prisma.Decimal('30') } },
      ]);

      const result = await service.findOne('a1');

      expect(prisma.account.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 'a1' } });
      expect(result.currentBalance.toString()).toBe('130');
    });
  });

  describe('update', () => {
    it('actualiza la cuenta, convierte el saldo y devuelve el saldo actual', async () => {
      const actualizada = {
        id: 'a1',
        name: 'Ahorros',
        initialBalance: new Prisma.Decimal('2000'),
        currency: Currency.EUR,
        isArchived: false,
      };
      prisma.account.update.mockResolvedValue(actualizada);
      prisma.transaction.groupBy.mockResolvedValue([
        { accountId: 'a1', type: 'EXPENSE', _sum: { accountAmount: new Prisma.Decimal('200') } },
      ]);

      const result = await service.update('a1', { name: 'Ahorros', initialBalance: 2000 });

      expect(prisma.account.update).toHaveBeenCalledOnce();
      const args = prisma.account.update.mock.calls[0][0];
      expect(args.where).toEqual({ id: 'a1' });
      expect(args.data.name).toBe('Ahorros');
      expect(args.data.initialBalance.toString()).toBe('2000');
      expect(result.currentBalance.toString()).toBe('1800');
    });
  });

  describe('archive', () => {
    it('archiva la cuenta y devuelve el saldo actual', async () => {
      const archivada = {
        id: 'a1',
        name: 'Cuenta principal',
        initialBalance: new Prisma.Decimal('100'),
        currency: Currency.EUR,
        isArchived: true,
      };
      prisma.account.update.mockResolvedValue(archivada);
      prisma.transaction.groupBy.mockResolvedValue([]);

      const result = await service.archive('a1');

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { isArchived: true },
      });
      expect(result.currentBalance.toString()).toBe('100');
    });
  });

  describe('restore', () => {
    it('desarchiva la cuenta y devuelve el saldo actual', async () => {
      const restaurada = {
        id: 'a1',
        name: 'Cuenta principal',
        initialBalance: new Prisma.Decimal('100'),
        currency: Currency.EUR,
        isArchived: false,
      };
      prisma.account.update.mockResolvedValue(restaurada);
      prisma.transaction.groupBy.mockResolvedValue([]);

      const result = await service.restore('a1');

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { isArchived: false },
      });
      expect(result.currentBalance.toString()).toBe('100');
    });
  });
});