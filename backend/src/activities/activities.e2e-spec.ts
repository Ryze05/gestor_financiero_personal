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

const fxStub = {
  getRate: async (from: string, to: string) =>
    new Prisma.Decimal(from === 'EUR' && to === 'USD' ? '1.08' : '0.9195'),
  convert: (amount: Prisma.Decimal, rate: Prisma.Decimal) =>
    amount.times(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
};

describe('Activities (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accountId: string;
  let expenseCategoryId: string;
  let incomeCategoryId: string;

  const uniqueName = () => `e2e-${randomUUID()}`;
  const post = (path: string, body: object) =>
    request(app.getHttpServer()).post(path).send(body);

  const get = (path: string) => request(app.getHttpServer()).get(path);

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

    const income = await post('/api/v1/categories', {
      name: uniqueName(),
      type: 'INCOME',
    }).expect(201);
    incomeCategoryId = income.body.id;
  });

  afterAll(async () => {
    await prisma.receipt.deleteMany({
      where: { externalId: { startsWith: 'e2e-' } },
    });
    await prisma.transaction.deleteMany({
      where: { concept: { startsWith: 'e2e-' } },
    });
    await prisma.category.deleteMany({
      where: { name: { startsWith: 'e2e-' } },
    });
    await prisma.account.deleteMany({
      where: { name: { startsWith: 'e2e-' } },
    });
    await app.close();
  });

  async function createTicket() {
    await post('/api/v1/receipts', {
      externalId: `e2e-${randomUUID()}`,
      merchant: 'e2e-Carrefour',
      date: '2026-09-20',
      total: 19,
      currency: 'EUR',
      accountId,
      lines: [
        { amount: 7, concept: 'e2e-Camiseta', categoryId: expenseCategoryId },
        { amount: 2, concept: 'e2e-Pan', categoryId: expenseCategoryId },
      ],
    }).expect(201);
  }

  async function createStandalone(overrides: object = {}) {
    const res = await post('/api/v1/transactions', {
      type: 'EXPENSE',
      amount: 10,
      currency: 'EUR',
      concept: `e2e-${randomUUID()}`,
      date: '2026-09-21',
      categoryId: expenseCategoryId,
      accountId,
      ...overrides,
    }).expect(201);
    return res.body;
  }

  it('agrupa un ticket como UNA actividad con sus líneas dentro', async () => {
    await createTicket();
    const res = await get(`/api/v1/activities?accountId=${accountId}`).expect(200);
    const ticket = res.body.data.find(
      (a: { type: string; receipt: { merchant: string } }) =>
        a.type === 'RECEIPT' && a.receipt.merchant === 'e2e-Carrefour',
    );
    expect(ticket).toBeDefined();
    expect(ticket.transactions).toHaveLength(2);
    expect(ticket.receipt.account?.id).toBe(accountId);
  });

  it('devuelve movimientos sueltos como actividades TRANSACTION', async () => {
    const created = await createStandalone();
    const res = await get(`/api/v1/activities?accountId=${accountId}`).expect(200);
    expect(
      res.body.data.some(
        (a: { type: string; transaction: { id: string } }) =>
          a.type === 'TRANSACTION' && a.transaction.id === created.id,
      ),
    ).toBe(true);
  });

  it('filtra por categoryId (un ticket coincide si alguna línea coincide)', async () => {
    await createTicket();
    const res = await get(
      `/api/v1/activities?accountId=${accountId}&categoryId=${expenseCategoryId}`,
    ).expect(200);
    expect(
      res.body.data.some(
        (a: { type: string; receipt?: { merchant: string } }) =>
          a.type === 'RECEIPT' && a.receipt?.merchant === 'e2e-Carrefour',
      ),
    ).toBe(true);
  });

  it('filtrar por type=INCOME excluye los tickets', async () => {
    const created = await post('/api/v1/transactions', {
      type: 'INCOME',
      amount: 100,
      currency: 'EUR',
      concept: `e2e-${randomUUID()}`,
      date: '2026-09-22',
      categoryId: incomeCategoryId,
      accountId,
    }).expect(201);
    const res = await get(
      `/api/v1/activities?accountId=${accountId}&type=INCOME`,
    ).expect(200);
    expect(
      res.body.data.every((a: { type: string }) => a.type === 'TRANSACTION'),
    ).toBe(true);
    expect(
      res.body.data.some(
        (a: { transaction: { id: string } }) =>
          a.transaction.id === created.body.id,
      ),
    ).toBe(true);
  });

  it('onlyReceipts=true devuelve solo tickets', async () => {
    await createTicket();
    await createStandalone();
    const res = await get(
      `/api/v1/activities?accountId=${accountId}&onlyReceipts=true`,
    ).expect(200);
    expect(
      res.body.data.every((a: { type: string }) => a.type === 'RECEIPT'),
    ).toBe(true);
  });

  it('pagina por actividades (limit cuenta compras)', async () => {
    const res = await get(
      `/api/v1/activities?accountId=${accountId}&limit=2&page=1`,
    ).expect(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.limit).toBe(2);
  });

  it('search encuentra por comercio del ticket', async () => {
    await createTicket();
    const res = await get(
      `/api/v1/activities?accountId=${accountId}&search=CARREFOUR`,
    ).expect(200);
    expect(
      res.body.data.some(
        (a: { type: string; receipt?: { merchant: string } }) =>
          a.type === 'RECEIPT' && a.receipt?.merchant === 'e2e-Carrefour',
      ),
    ).toBe(true);
  });

  it('minAmount/maxAmount filtra por total visible', async () => {
    await createTicket(); // total 19
    const dentro = await get(
      `/api/v1/activities?accountId=${accountId}&minAmount=10&maxAmount=20`,
    ).expect(200);
    expect(
      dentro.body.data.some(
        (a: { type: string; receipt?: { merchant: string } }) =>
          a.type === 'RECEIPT' && a.receipt?.merchant === 'e2e-Carrefour',
      ),
    ).toBe(true);

    const fuera = await get(
      `/api/v1/activities?accountId=${accountId}&minAmount=50`,
    ).expect(200);
    expect(
      fuera.body.data.some(
        (a: { type: string; receipt?: { merchant: string } }) =>
          a.type === 'RECEIPT' && a.receipt?.merchant === 'e2e-Carrefour',
      ),
    ).toBe(false);
  });

  it('from/to filtra por fecha', async () => {
    await createTicket(); // 2026-09-20
    const res = await get(
      `/api/v1/activities?accountId=${accountId}&from=2026-09-01&to=2026-09-30`,
    ).expect(200);
    expect(
      res.body.data.some(
        (a: { type: string; receipt?: { merchant: string } }) =>
          a.type === 'RECEIPT' && a.receipt?.merchant === 'e2e-Carrefour',
      ),
    ).toBe(true);
  });

  it('categoryId en negativo (ticket que no coincide)', async () => {
    const otra = await post('/api/v1/categories', {
      name: uniqueName(),
      type: 'EXPENSE',
    }).expect(201);
    await createTicket(); // líneas en expenseCategoryId, NO en "otra"
    const res = await get(
      `/api/v1/activities?accountId=${accountId}&categoryId=${otra.body.id}`,
    ).expect(200);
    expect(
      res.body.data.some(
        (a: { type: string; receipt?: { merchant: string } }) =>
          a.type === 'RECEIPT' && a.receipt?.merchant === 'e2e-Carrefour',
      ),
    ).toBe(false);
  });

  it('search encuentra por concepto de línea', async () => {
    await createTicket(); // líneas: e2e-Camiseta, e2e-Pan
    const res = await get(
      `/api/v1/activities?accountId=${accountId}&search=CAMISETA`,
    ).expect(200);
    expect(
      res.body.data.some(
        (a: { type: string; receipt?: { merchant: string } }) =>
          a.type === 'RECEIPT' && a.receipt?.merchant === 'e2e-Carrefour',
      ),
    ).toBe(true);
  });

  it('minAmount negativo → 400', async () => {
    await get(`/api/v1/activities?accountId=${accountId}&minAmount=-5`).expect(400);
  });

  it('from inválido → 400', async () => {
    await get(`/api/v1/activities?accountId=${accountId}&from=no-es-fecha`).expect(400);
  });
});