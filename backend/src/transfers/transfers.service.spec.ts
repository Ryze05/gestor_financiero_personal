import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { TransfersService } from './transfers.service.js';

describe('TransfersService', () => {
  let service: TransfersService;

  const prisma = {
    account: { findUnique: vi.fn() },
    category: { findUnique: vi.fn() },
    transfer: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    transaction: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  };
  const exchangeRate = {
    getRate: vi.fn(),
    convert: (amount: Prisma.Decimal, rate: Prisma.Decimal) =>
      amount.times(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
  };

  const dto = {
    amount: 10,
    date: '2026-09-25',
    sourceAccountId: 'source-id',
    destinationAccountId: 'destination-id',
  };

  const account = (overrides: object = {}) => ({
    id: 'account-id',
    currency: 'EUR',
    isArchived: false,
    ...overrides,
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        TransfersService,
        { provide: PrismaService, useValue: prisma },
        { provide: ExchangeRateService, useValue: exchangeRate },
      ],
    }).compile();
    service = module.get(TransfersService);
  });

  describe('create', () => {
    it('rejects when both accounts are the same', async () => {
      await expect(
        service.create({ ...dto, destinationAccountId: dto.sourceAccountId }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects when an account does not exist or is archived', async () => {
      prisma.account.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(account());

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('converts the destination amount when currencies differ', async () => {
      prisma.account.findUnique
        .mockResolvedValueOnce(account({ currency: 'EUR' }))
        .mockResolvedValueOnce(account({ currency: 'USD' }));
      exchangeRate.getRate.mockResolvedValue(new Prisma.Decimal('1.08'));

      const tx = {
        transfer: {
          create: vi.fn().mockResolvedValue({ id: 'transfer-id' }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'transfer-id' }),
        },
        transaction: { create: vi.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation(
        (callback: (client: typeof tx) => unknown) => callback(tx),
      );

      await service.create({ ...dto, amount: 100 });

      expect(exchangeRate.getRate).toHaveBeenCalledWith('EUR', 'USD');
      const transferData = tx.transfer.create.mock.calls[0][0].data;
      expect(transferData.destinationAmount.toString()).toBe('108');
      expect(transferData.exchangeRate.toString()).toBe('1.08');

      const [expense, income] = tx.transaction.create.mock.calls.map(
        (call) => call[0].data,
      );
      expect(expense.amount.toString()).toBe('100');
      expect(expense.currency).toBe('EUR');
      expect(expense.accountAmount.toString()).toBe('100');
      expect(income.amount.toString()).toBe('108');
      expect(income.currency).toBe('USD');
      expect(income.accountAmount.toString()).toBe('108');
    });

    it('creates the transfer and both transactions with the expected data', async () => {
      prisma.account.findUnique
        .mockResolvedValueOnce(account({ currency: 'EUR' }))
        .mockResolvedValueOnce(account({ currency: 'EUR' }));

      const tx = {
        transfer: {
          create: vi.fn().mockResolvedValue({ id: 'transfer-id' }),
          findUniqueOrThrow: vi
            .fn()
            .mockResolvedValue({ id: 'transfer-id' }),
        },
        transaction: { create: vi.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation(
        (callback: (client: typeof tx) => unknown) => callback(tx),
      );

      await service.create({ ...dto, concept: 'Ahorro' });

      const transferData = tx.transfer.create.mock.calls[0][0].data;
      expect(transferData.sourceCurrency).toBe('EUR');
      expect(transferData.destinationCurrency).toBe('EUR');
      expect(transferData.amount.toString()).toBe('10');
      expect(transferData.destinationAmount.toString()).toBe('10');
      expect(transferData.exchangeRate.toString()).toBe('1');
      expect(transferData.concept).toBe('Ahorro');

      const [expense, income] = tx.transaction.create.mock.calls.map(
        (call) => call[0].data,
      );
      expect(expense.type).toBe('EXPENSE');
      expect(expense.accountId).toBe('source-id');
      expect(expense.transferId).toBe('transfer-id');
      expect(income.type).toBe('INCOME');
      expect(income.accountId).toBe('destination-id');
      expect(income.transferId).toBe('transfer-id');
      expect(tx.transaction.create).toHaveBeenCalledTimes(2);
    });

    it('uses "Transferencia" as the default concept', async () => {
      prisma.account.findUnique
        .mockResolvedValueOnce(account())
        .mockResolvedValueOnce(account());

      const tx = {
        transfer: {
          create: vi.fn().mockResolvedValue({ id: 'transfer-id' }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'transfer-id' }),
        },
        transaction: { create: vi.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation(
        (callback: (client: typeof tx) => unknown) => callback(tx),
      );

      await service.create(dto);

      expect(tx.transfer.create.mock.calls[0][0].data.concept).toBe(
        'Transferencia',
      );
    });

    it('propagates errors from the atomic operation (no partial save)', async () => {
      prisma.account.findUnique
        .mockResolvedValueOnce(account())
        .mockResolvedValueOnce(account());

      const tx = {
        transfer: {
          create: vi.fn().mockResolvedValue({ id: 'transfer-id' }),
          findUniqueOrThrow: vi.fn(),
        },
        transaction: {
          create: vi.fn().mockRejectedValue(new Error('db down')),
        },
      };
      prisma.$transaction.mockImplementation(
        (callback: (client: typeof tx) => unknown) => callback(tx),
      );

      await expect(service.create(dto)).rejects.toThrow('db down');
    });
  });

  describe('update', () => {
    const existing = {
      id: 'transfer-id',
      amount: new Prisma.Decimal('10'),
      date: new Date('2026-09-25'),
      concept: 'Ahorro',
      sourceCurrency: 'EUR',
      destinationCurrency: 'EUR',
      sourceAccountId: 'source-id',
      destinationAccountId: 'destination-id',
      destinationAmount: new Prisma.Decimal('10'),
      exchangeRate: new Prisma.Decimal('1'),
    };

    const client = () => ({
      transfer: {
        update: vi.fn().mockResolvedValue({ id: 'transfer-id' }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'transfer-id' }),
      },
      transaction: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    });

    const stubAccounts = (currencyA = 'EUR', currencyB = 'EUR') => {
      prisma.account.findUnique
        .mockResolvedValueOnce(account({ currency: currencyA }))
        .mockResolvedValueOnce(account({ currency: currencyB }));
    };

    beforeEach(() => {
      prisma.transfer.findUniqueOrThrow.mockResolvedValue(existing);
    });

    it('rejects when both accounts are the same', async () => {
      await expect(
        service.update('transfer-id', {
          destinationAccountId: 'source-id',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects when an account does not exist or is archived', async () => {
      prisma.account.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(account());

      await expect(
        service.update('transfer-id', { amount: 25 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('converts the destination amount when currencies differ', async () => {
      stubAccounts('EUR', 'USD');
      exchangeRate.getRate.mockResolvedValue(new Prisma.Decimal('1.08'));
      const p = client();
      prisma.$transaction.mockImplementation(
        (callback: (client: typeof p) => unknown) => callback(p),
      );

      await service.update('transfer-id', { amount: 100 });

      const transferData = p.transfer.update.mock.calls[0][0].data;
      expect(transferData.destinationAmount.toString()).toBe('108');
      expect(transferData.exchangeRate.toString()).toBe('1.08');

      const [expenseCall, incomeCall] = p.transaction.updateMany.mock.calls;
      expect(expenseCall[0].data.amount.toString()).toBe('100');
      expect(expenseCall[0].data.currency).toBe('EUR');
      expect(incomeCall[0].data.amount.toString()).toBe('108');
      expect(incomeCall[0].data.currency).toBe('USD');
    });

    it('updates the transfer and both movements atomically with the partial dto', async () => {
      stubAccounts();
      const p = client();
      prisma.$transaction.mockImplementation(
        (callback: (client: typeof p) => unknown) => callback(p),
      );

      await service.update('transfer-id', { amount: 25, concept: 'Nuevo' });

      const transferData = p.transfer.update.mock.calls[0][0].data;
      expect(transferData.amount.toString()).toBe('25');
      expect(transferData.concept).toBe('Nuevo');
      expect(transferData.sourceAccountId).toBe('source-id');
      expect(transferData.destinationAccountId).toBe('destination-id');

      expect(p.transaction.updateMany).toHaveBeenCalledTimes(2);
      const [expenseCall, incomeCall] = p.transaction.updateMany.mock.calls;
      expect(expenseCall[0].where).toEqual({
        transferId: 'transfer-id',
        type: 'EXPENSE',
      });
      expect(expenseCall[0].data.accountId).toBe('source-id');
      expect(expenseCall[0].data.amount.toString()).toBe('25');
      expect(incomeCall[0].where).toEqual({
        transferId: 'transfer-id',
        type: 'INCOME',
      });
      expect(incomeCall[0].data.accountId).toBe('destination-id');
    });

    it('keeps existing values when fields are omitted', async () => {
      stubAccounts();
      const p = client();
      prisma.$transaction.mockImplementation(
        (callback: (client: typeof p) => unknown) => callback(p),
      );

      await service.update('transfer-id', {});

      const transferData = p.transfer.update.mock.calls[0][0].data;
      expect(transferData.amount.toString()).toBe('10');
      expect(transferData.date).toEqual(new Date('2026-09-25'));
      expect(transferData.concept).toBe('Ahorro');
    });

    it('falls back to "Transferencia" when the existing concept is null', async () => {
      prisma.transfer.findUniqueOrThrow.mockResolvedValue({
        ...existing,
        concept: null,
      });
      stubAccounts();
      const p = client();
      prisma.$transaction.mockImplementation(
        (callback: (client: typeof p) => unknown) => callback(p),
      );

      await service.update('transfer-id', {});

      expect(p.transfer.update.mock.calls[0][0].data.concept).toBe(
        'Transferencia',
      );
      expect(p.transaction.updateMany.mock.calls[0][0].data.concept).toBe(
        'Transferencia',
      );
    });

    it('propagates errors from the atomic operation (no partial save)', async () => {
      stubAccounts();
      const p = client();
      p.transaction.updateMany.mockRejectedValue(new Error('db down'));
      prisma.$transaction.mockImplementation(
        (callback: (client: typeof p) => unknown) => callback(p),
      );

      await expect(
        service.update('transfer-id', { amount: 25 }),
      ).rejects.toThrow('db down');
    });
  });

  describe('findAll', () => {
    it('paginates, filters and includes the accounts', async () => {
      prisma.transfer.findMany.mockResolvedValue([]);
      prisma.transfer.count.mockResolvedValue(0);

      const result = await service.findAll({
        from: '2026-09-01',
        to: '2026-09-30',
        search: 'ahorro',
        page: 1,
        limit: 20,
      });

      expect(prisma.transfer.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.transfer.count).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
    });
  });

  describe('findOne', () => {
    it('returns the transfer with its accounts and transactions', async () => {
      prisma.transfer.findUniqueOrThrow.mockResolvedValue({
        id: 'transfer-id',
      });

      const result = await service.findOne('transfer-id');

      expect(result).toEqual({ id: 'transfer-id' });
      expect(prisma.transfer.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 'transfer-id' },
        include: {
          sourceAccount: true,
          destinationAccount: true,
          transactions: true,
        },
      });
    });
  });

  describe('remove', () => {
    it('deletes the transfer by id', async () => {
      prisma.transfer.delete.mockResolvedValue({ id: 'transfer-id' });

      await service.remove('transfer-id');

      expect(prisma.transfer.delete).toHaveBeenCalledWith({
        where: { id: 'transfer-id' },
      });
    });

    it('propagates errors (e.g. not found)', async () => {
      prisma.transfer.delete.mockRejectedValue(new Error('P2025'));

      await expect(service.remove('missing-id')).rejects.toThrow('P2025');
    });
  });
});
