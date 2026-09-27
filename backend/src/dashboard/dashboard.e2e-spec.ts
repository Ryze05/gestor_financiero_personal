import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../app.module.js';
import { setupApp } from '../app.setup.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('Dashboard (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accountId: string;
  let expenseCategoryId: string;
  let expenseCategory2Id: string;
  let incomeCategoryId: string;

  const uniqueName = () => `e2e-${randomUUID()}`;
  const post = (path: string, body: object) =>
    request(app.getHttpServer()).post(path).send(body);

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
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    const account = await post('/api/v1/accounts', {
      name: uniqueName(),
      currency: 'EUR',
    }).expect(201);
    accountId = account.body.id;

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
    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard?from=2000-01-01&to=2000-01-31')
      .expect(200);

    expect(res.body).toEqual({
      from: '2000-01-01',
      to: '2000-01-31',
      currency: 'EUR',
      income: '0',
      expense: '0',
      balance: '0',
      count: 0,
      byCategory: [],
    });
  });

  it('con movimientos → totales y byCategory', async () => {
    await createTransaction({
      type: 'INCOME',
      amount: 100,
      categoryId: incomeCategoryId,
    }).expect(201);
    await createTransaction({ type: 'EXPENSE', amount: 40 }).expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard?from=2026-09-01&to=2026-09-30')
      .expect(200);

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
      date: '2026-08-15',
    }).expect(201);
    await createTransaction({
      type: 'EXPENSE',
      amount: 30,
      categoryId: expenseCategory2Id,
      date: '2026-08-15',
    }).expect(201);
    await createTransaction({
      type: 'INCOME',
      amount: 500,
      categoryId: incomeCategoryId,
      date: '2026-08-15',
    }).expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard?from=2026-08-01&to=2026-08-31')
      .expect(200);

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

  it('filtra por moneda (USD sin datos) → ceros', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard?from=2026-09-01&to=2026-09-30&currency=USD')
      .expect(200);

    expect(res.body.count).toBe(0);
  });

  it('currency inválida → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/dashboard?currency=GBP')
      .expect(400);
  });

  it('fecha inválida → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/dashboard?from=no-es-fecha')
      .expect(400);
  });
});