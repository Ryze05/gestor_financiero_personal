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

describe('Dashboard (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accountId: string;
  let usdAccountId: string;
  let expenseCategoryId: string;
  let expenseCategory2Id: string;
  let incomeCategoryId: string;

  const uniqueName = () => `e2e-${randomUUID()}`;
  const post = (path: string, body: object) =>
    request(app.getHttpServer()).post(path).send(body);
  const dashboard = (query: string) =>
    request(app.getHttpServer()).get(
      `/api/v1/dashboard?accountId=${accountId}&${query}`,
    );

  const createTransaction = (overrides: object = {}) =>
    post('/api/v1/transactions', {
      type: 'EXPENSE',
      amount: 10,
      currency: 'EUR',
      concept: `e2e-${randomUUID()}`,
      date: '2026-09-25',
      categoryId: expenseCategoryId,
      accountId,
      ...overrides,
    });

  const createCategory = async (type: string) => {
    const res = await post('/api/v1/categories', {
      name: uniqueName(),
      type,
    }).expect(201);
    return res.body.id;
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

    const usdAccount = await post('/api/v1/accounts', {
      name: uniqueName(),
      currency: 'USD',
    }).expect(201);
    usdAccountId = usdAccount.body.id;

    expenseCategoryId = await createCategory('EXPENSE');
    expenseCategory2Id = await createCategory('EXPENSE');
    incomeCategoryId = await createCategory('INCOME');
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({
      where: { concept: { startsWith: 'e2e' } },
    });
    await prisma.category.deleteMany({
      where: { name: { startsWith: 'e2e-' } },
    });
    await prisma.account.deleteMany({
      where: { name: { startsWith: 'e2e-' } },
    });
    await app.close();
  });

  it('sin movimientos en el periodo → ceros', async () => {
    const res = await dashboard('from=2000-01-01&to=2000-01-31').expect(200);

    expect(res.body).toEqual(
      expect.objectContaining({
        from: '2000-01-01',
        to: '2000-01-31',
        currency: 'EUR',
        income: '0',
        expense: '0',
        balance: '0',
        count: 0,
        byCategory: [],
      }),
    );
    expect(res.body.timeline).toHaveLength(31);
    expect(res.body.timeline[0]).toEqual({
      date: '2000-01-01',
      income: '0',
      expense: '0',
      transferIn: '0',
      transferOut: '0',
    });
    expect(res.body.timeline[30]).toEqual({
      date: '2000-01-31',
      income: '0',
      expense: '0',
      transferIn: '0',
      transferOut: '0',
    });
  });

  it('con movimientos → totales y byCategory', async () => {
    await createTransaction({
      type: 'INCOME',
      amount: 100,
      categoryId: incomeCategoryId,
      date: '2000-02-15',
    }).expect(201);
    await createTransaction({
      type: 'EXPENSE',
      amount: 40,
      date: '2000-02-15',
    }).expect(201);

    const res = await dashboard('from=2000-02-01&to=2000-02-28').expect(200);

    expect(res.body.income).toBe('100');
    expect(res.body.expense).toBe('40');
    expect(res.body.balance).toBe('60');
    expect(res.body.count).toBe(2);
    expect(res.body.byCategory).toContainEqual({
      categoryId: expenseCategoryId,
      name: expect.any(String),
      total: '40',
    });
  });

  it('byCategory agrupa varias categorías y excluye ingresos', async () => {
    await createTransaction({
      type: 'EXPENSE',
      amount: 20,
      categoryId: expenseCategoryId,
      date: '2000-03-15',
    }).expect(201);
    await createTransaction({
      type: 'EXPENSE',
      amount: 30,
      categoryId: expenseCategory2Id,
      date: '2000-03-15',
    }).expect(201);
    await createTransaction({
      type: 'INCOME',
      amount: 500,
      categoryId: incomeCategoryId,
      date: '2000-03-15',
    }).expect(201);

    const res = await dashboard('from=2000-03-01&to=2000-03-31').expect(200);

    const byCategory = res.body.byCategory as {
      categoryId: string;
      total: string;
    }[];
    const ids = byCategory.map((c) => c.categoryId).sort();

    expect(ids).toEqual([expenseCategoryId, expenseCategory2Id].sort());
    expect(byCategory.some((c) => c.categoryId === incomeCategoryId)).toBe(false);
    expect(
      byCategory.find((c) => c.categoryId === expenseCategoryId)?.total,
    ).toBe('20');
    expect(
      byCategory.find((c) => c.categoryId === expenseCategory2Id)?.total,
    ).toBe('30');
  });

  it('incluye movimientos en otra moneda usando accountAmount', async () => {
    const created = await createTransaction({
      amount: 23.4,
      currency: 'USD',
      date: '2000-09-25',
    }).expect(201);
    expect(created.body.accountAmount).toBe('21.52');
    expect(created.body.exchangeRate).toBe('0.9195');

    const res = await dashboard('from=2000-09-01&to=2000-09-30').expect(200);

    expect(res.body.currency).toBe('EUR');
    expect(res.body.expense).toBe('21.52');
    expect(res.body.balance).toBe('-21.52');
    expect(res.body.count).toBe(1);
    expect(res.body.timeline).toHaveLength(30);
    expect(
      res.body.timeline.find(
        (point: { date: string }) => point.date === '2000-09-25',
      ),
    ).toEqual({
      date: '2000-09-25',
      income: '0',
      expense: '21.52',
      transferIn: '0',
      transferOut: '0',
    });
    expect(res.body.byCategory).toContainEqual({
      categoryId: expenseCategoryId,
      name: expect.any(String),
      total: '21.52',
    });
  });

  it('filtra por cuenta (otra cuenta sin datos) → ceros', async () => {
    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/dashboard?accountId=${usdAccountId}&from=2000-02-01&to=2000-02-28`,
      )
      .expect(200);

    expect(res.body.count).toBe(0);
    expect(res.body.currency).toBe('USD');
  });

  it('cuenta inexistente → 404', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/dashboard?accountId=${MISSING_ID}`)
      .expect(404);
  });

  it('accountId inválido → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/dashboard?accountId=no-es-uuid')
      .expect(400);
  });

  it('fecha inválida → 400', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/dashboard?accountId=${accountId}&from=no-es-fecha`)
      .expect(400);
  });
});
