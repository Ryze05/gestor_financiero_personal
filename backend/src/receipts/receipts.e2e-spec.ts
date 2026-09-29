import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../app.module.js';
import { setupApp } from '../app.setup.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service.js';
import { Prisma } from '../generated/prisma/client.js';

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

const fxStub = {
  getRate: async (from: string, to: string) =>
    new Prisma.Decimal(from === 'EUR' && to === 'USD' ? '1.08' : '0.9195'),
  convert: (amount: Prisma.Decimal, rate: Prisma.Decimal) =>
    amount.times(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
};

describe('Receipts (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accountId: string;
  let expenseCategoryId: string;

  const uniqueName = () => `e2e-${randomUUID()}`;
  const post = (path: string, body: object) =>
    request(app.getHttpServer()).post(path).send(body);

  const validReceipt = (overrides: object = {}) => ({
    externalId: `e2e-${randomUUID()}`,
    merchant: 'e2e-carrefour',
    date: '2026-09-25',
    total: 19,
    currency: 'EUR',
    accountId,
    lines: [
      { amount: 7, concept: 'e2e-Camiseta', categoryId: expenseCategoryId },
      { amount: 2, concept: 'e2e-Pan', categoryId: expenseCategoryId },
      { amount: 10, concept: 'e2e-Crema', categoryId: expenseCategoryId },
    ],
    ...overrides,
  });

  const createReceipt = async (overrides: object = {}) => {
    const res = await post('/api/v1/receipts', validReceipt(overrides)).expect(201);
    return res.body;
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ExchangeRateService)
      .useValue(fxStub)
      .compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    const account = await post('/api/v1/accounts', {
      name: uniqueName(),
      currency: 'EUR',
    }).expect(201);
    accountId = account.body.id;

    const expense = await post('/api/v1/categories', {
      name: uniqueName(),
      type: 'EXPENSE',
    }).expect(201);
    expenseCategoryId = expense.body.id;
  });

  afterAll(async () => {
    await prisma.receipt.deleteMany({
      where: { externalId: { startsWith: 'e2e-' } },
    });
    await prisma.category.deleteMany({
      where: { name: { startsWith: 'e2e-' } },
    });
    await prisma.account.deleteMany({
      where: { name: { startsWith: 'e2e-' } },
    });
    await app.close();
  });

  it('POST crea un ticket y sus movimientos agrupados → 201', async () => {
    const res = await post('/api/v1/receipts', validReceipt()).expect(201);
    expect(res.body.receipt.merchant).toBe('e2e-carrefour');
    expect(res.body.receipt.total).toBe('19');
    expect(res.body.transactions).toHaveLength(3);
    expect(
      res.body.transactions.every(
        (t: { receiptId: string }) => t.receiptId === res.body.receipt.id,
      ),
    ).toBe(true);
    expect(res.body.transactions[0].category?.id).toBe(expenseCategoryId);
  });

  it('POST idempotente → mismo id sin duplicar', async () => {
    const receipt = await createReceipt();
    const res = await post('/api/v1/receipts', {
      ...validReceipt(),
      externalId: receipt.receipt.externalId,
    }).expect(201);
    expect(res.body.receipt.id).toBe(receipt.receipt.id);
    expect(res.body.transactions).toHaveLength(3);
  });

  it('POST vacío → 400', async () => {
    await post('/api/v1/receipts', {}).expect(400);
  });

  it('POST lines vacío → 400', async () => {
    await post(
      '/api/v1/receipts',
      validReceipt({ lines: [] }),
    ).expect(400);
  });

  it('POST línea con categoría incompatible → 400', async () => {
    const income = await post('/api/v1/categories', {
      name: uniqueName(),
      type: 'INCOME',
    }).expect(201);
    await post('/api/v1/receipts', {
      ...validReceipt(),
      lines: [
        { amount: 10, concept: 'e2e-X', categoryId: income.body.id },
      ],
    }).expect(400);
  });

  it('POST cuenta inexistente → 400', async () => {
    await post(
      '/api/v1/receipts',
      validReceipt({ accountId: MISSING_ID }),
    ).expect(400);
  });

  it('POST moneda distinta a la cuenta → conversión por línea', async () => {
    const res = await post(
      '/api/v1/receipts',
      validReceipt({ currency: 'USD' }),
    ).expect(201);
    expect(res.body.transactions[0].currency).toBe('USD');
    expect(res.body.transactions[0].exchangeRate).toBe('0.9195');
  });

  it('GET paginado → 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/receipts')
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });

  it('GET id existente → 200 con movimientos', async () => {
    const receipt = await createReceipt();
    const res = await request(app.getHttpServer())
      .get(`/api/v1/receipts/${receipt.receipt.id}`)
      .expect(200);
    expect(res.body.transactions).toHaveLength(3);
  });

  it('GET id inexistente → 404', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/receipts/${MISSING_ID}`)
      .expect(404);
  });

  it('DELETE → borra ticket y sus movimientos', async () => {
    const receipt = await createReceipt();
    await request(app.getHttpServer())
      .delete(`/api/v1/receipts/${receipt.receipt.id}`)
      .expect(200);
    const txs = await prisma.transaction.findMany({
      where: { receiptId: receipt.receipt.id },
    });
    expect(txs).toHaveLength(0);
  });

  it('DELETE id inexistente → 404', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/receipts/${MISSING_ID}`)
      .expect(404);
  });
});