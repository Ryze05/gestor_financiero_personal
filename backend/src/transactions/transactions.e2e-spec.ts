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

describe('Transactions (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accountId: string;
  let expenseCategoryId: string;
  let incomeCategoryId: string;

  const uniqueName = () => `e2e-${randomUUID()}`;
  const post = (path: string, body: object) =>
    request(app.getHttpServer()).post(path).send(body);

  const validTransaction = (overrides: object = {}) => ({
    type: 'EXPENSE',
    amount: 10,
    currency: 'EUR',
    concept: `e2e-${randomUUID()}`,
    date: '2026-09-25',
    categoryId: expenseCategoryId,
    accountId,
    ...overrides,
  });

  const createTransaction = async (overrides: object = {}) => {
    const res = await post(
      '/api/v1/transactions',
      validTransaction(overrides),
    ).expect(201);
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

    const income = await post('/api/v1/categories', {
      name: uniqueName(),
      type: 'INCOME',
    }).expect(201);
    incomeCategoryId = income.body.id;
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

  it('GET paginado → 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/transactions')
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
  });

  it('GET ?page=0 → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/transactions?page=0')
      .expect(400);
  });

  it('GET ?limit=1000 → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/transactions?limit=1000')
      .expect(400);
  });

  it('GET filtro type → 200', async () => {
    await createTransaction();
    const res = await request(app.getHttpServer())
      .get('/api/v1/transactions?type=EXPENSE')
      .expect(200);
    expect(res.body.data.every((t: { type: string }) => t.type === 'EXPENSE')).toBe(
      true,
    );
  });

  it('GET filtro search insensible → 200', async () => {
    const created = await createTransaction({ concept: 'e2e-mercadona' });
    const res = await request(app.getHttpServer())
      .get('/api/v1/transactions?search=MERCADONA')
      .expect(200);
    expect(res.body.data.some((t: { id: string }) => t.id === created.id)).toBe(
      true,
    );
  });

  it('GET filtro categoryId → 200', async () => {
    const created = await createTransaction();
    const res = await request(app.getHttpServer())
      .get(`/api/v1/transactions?categoryId=${expenseCategoryId}`)
      .expect(200);
    expect(res.body.data.some((t: { id: string }) => t.id === created.id)).toBe(
      true,
    );
  });

  it('GET filtro from/to → 200', async () => {
    const created = await createTransaction({ date: '2026-09-25' });
    const dentro = await request(app.getHttpServer())
      .get('/api/v1/transactions?from=2026-09-01&to=2026-09-30')
      .expect(200);
    expect(dentro.body.data.some((t: { id: string }) => t.id === created.id)).toBe(
      true,
    );

    const fuera = await request(app.getHttpServer())
      .get('/api/v1/transactions?from=2026-10-01')
      .expect(200);
    expect(fuera.body.data.some((t: { id: string }) => t.id === created.id)).toBe(
      false,
    );
  });

  it('GET filtro source → 200', async () => {
    const created = await createTransaction({
      source: 'OPENCLAW',
      externalId: `e2e-${randomUUID()}`,
    });
    const res = await request(app.getHttpServer())
      .get('/api/v1/transactions?source=OPENCLAW')
      .expect(200);
    expect(res.body.data.some((t: { id: string }) => t.id === created.id)).toBe(
      true,
    );
    expect(
      res.body.data.every((t: { source: string }) => t.source === 'OPENCLAW'),
    ).toBe(true);
  });

  it('GET filtro source inválido → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/transactions?source=OTRO')
      .expect(400);
  });

  it('GET filtro accountAmount min/max → 200', async () => {
    const created = await createTransaction({ amount: 50 });
    const dentro = await request(app.getHttpServer())
      .get('/api/v1/transactions?minAmount=10&maxAmount=100')
      .expect(200);
    expect(
      dentro.body.data.some((t: { id: string }) => t.id === created.id),
    ).toBe(true);

    const fuera = await request(app.getHttpServer())
      .get('/api/v1/transactions?minAmount=200')
      .expect(200);
    expect(fuera.body.data.some((t: { id: string }) => t.id === created.id)).toBe(
      false,
    );
  });

  it('GET minAmount con 3 decimales → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/transactions?minAmount=1.234')
      .expect(400);
  });

  it('GET minAmount negativo → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/transactions?minAmount=-5')
      .expect(400);
  });

  it('POST válido → 201 con accountAmount y exchangeRate', async () => {
    const res = await post(
      '/api/v1/transactions',
      validTransaction({ amount: 23.4 }),
    ).expect(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.accountAmount).toBe('23.4');
    expect(res.body.exchangeRate).toBe('1');
  });

  it('POST inválido → 400', async () => {
    await post('/api/v1/transactions', {}).expect(400);
  });

  it('POST amount 0 → 400', async () => {
    await post(
      '/api/v1/transactions',
      validTransaction({ amount: 0 }),
    ).expect(400);
  });

  it('POST amount con 3 decimales → 400', async () => {
    await post(
      '/api/v1/transactions',
      validTransaction({ amount: 1.234 }),
    ).expect(400);
  });

  it('POST date inválida → 400', async () => {
    await post(
      '/api/v1/transactions',
      validTransaction({ date: 'no-es-fecha' }),
    ).expect(400);
  });

  it('POST type inválido → 400', async () => {
    await post(
      '/api/v1/transactions',
      validTransaction({ type: 'OTRO' }),
    ).expect(400);
  });

  it('POST amount negativo → 400', async () => {
    await post(
      '/api/v1/transactions',
      validTransaction({ amount: -5 }),
    ).expect(400);
  });

  it('POST concept de más de 150 caracteres → 400', async () => {
    await post(
      '/api/v1/transactions',
      validTransaction({ concept: 'a'.repeat(151) }),
    ).expect(400);
  });

  it('POST notes de más de 500 caracteres → 400', async () => {
    await post(
      '/api/v1/transactions',
      validTransaction({ notes: 'a'.repeat(501) }),
    ).expect(400);
  });

  it('POST OPENCLAW con externalId demasiado corto → 400', async () => {
    await post(
      '/api/v1/transactions',
      validTransaction({ source: 'OPENCLAW', externalId: 'ab' }),
    ).expect(400);
  });

  it('POST con notes opcional → 201', async () => {
    const res = await post(
      '/api/v1/transactions',
      validTransaction({ notes: 'e2e una nota' }),
    ).expect(201);
    expect(res.body.notes).toBe('e2e una nota');
  });

  it('POST concept vacío → 400', async () => {
    await post(
      '/api/v1/transactions',
      validTransaction({ concept: '   ' }),
    ).expect(400);
  });

  it('PATCH con cuerpo vacío → 200 (sin cambios)', async () => {
    const created = await createTransaction();
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/transactions/${created.id}`)
      .send({})
      .expect(200);
    expect(res.body.id).toBe(created.id);
  });

  it('PATCH amount con 3 decimales → 400', async () => {
    const created = await createTransaction();
    await request(app.getHttpServer())
      .patch(`/api/v1/transactions/${created.id}`)
      .send({ amount: 1.234 })
      .expect(400);
  });

  it('PATCH con campo no permitido → 400', async () => {
    const created = await createTransaction();
    await request(app.getHttpServer())
      .patch(`/api/v1/transactions/${created.id}`)
      .send({ foo: 'bar' })
      .expect(400);
  });

  it('POST con campo no permitido → 400', async () => {
    await post('/api/v1/transactions', {
      ...validTransaction(),
      foo: 'bar',
    }).expect(400);
  });

  it('POST categoría incompatible → 400', async () => {
    await post(
      '/api/v1/transactions',
      validTransaction({ type: 'INCOME', categoryId: expenseCategoryId }),
    ).expect(400);
  });

  it('POST cuenta inexistente → 400', async () => {
    await post(
      '/api/v1/transactions',
      validTransaction({ accountId: MISSING_ID }),
    ).expect(400);
  });

  it('POST moneda distinta a la cuenta → 201 con conversión', async () => {
    const res = await post(
      '/api/v1/transactions',
      validTransaction({ amount: 23.4, currency: 'USD' }),
    ).expect(201);
    expect(res.body.currency).toBe('USD');
    expect(res.body.accountAmount).toBe('21.52');
    expect(res.body.exchangeRate).toBe('0.9195');
  });

  it('POST OPENCLAW sin externalId → 400', async () => {
    await post(
      '/api/v1/transactions',
      validTransaction({ source: 'OPENCLAW' }),
    ).expect(400);
  });

  it('POST OPENCLAW idempotente → mismo id', async () => {
    const externalId = `e2e-${randomUUID()}`;
    const first = await post(
      '/api/v1/transactions',
      validTransaction({ source: 'OPENCLAW', externalId }),
    ).expect(201);
    const second = await post(
      '/api/v1/transactions',
      validTransaction({ source: 'OPENCLAW', externalId }),
    ).expect(201);
    expect(second.body.id).toBe(first.body.id);
  });

  it('POST ingreso con categoría INCOME → 201', async () => {
    const res = await post(
      '/api/v1/transactions',
      validTransaction({ type: 'INCOME', categoryId: incomeCategoryId }),
    ).expect(201);
    expect(res.body.type).toBe('INCOME');
  });

  it('GET id existente → 200', async () => {
    const created = await createTransaction();
    const res = await request(app.getHttpServer())
      .get(`/api/v1/transactions/${created.id}`)
      .expect(200);
    expect(res.body.id).toBe(created.id);
  });

  it('GET incluye nombres de cuenta y categoria → 200', async () => {
    const created = await createTransaction();
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/transactions/${created.id}`)
      .expect(200);
    expect(detail.body.account?.id).toBe(accountId);
    expect(detail.body.category?.id).toBe(expenseCategoryId);

    const list = await request(app.getHttpServer())
      .get(`/api/v1/transactions?search=${created.concept}`)
      .expect(200);
    const found = list.body.data.find(
      (t: { id: string }) => t.id === created.id,
    );
    expect(found.account?.name).toBeDefined();
    expect(found.category?.name).toBeDefined();
  });

  it('GET id inexistente → 404', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/transactions/${MISSING_ID}`)
      .expect(404);
  });

  it('GET id mal formado → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/transactions/no-es-uuid')
      .expect(400);
  });

  it('PATCH válido → 200', async () => {
    const created = await createTransaction();
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/transactions/${created.id}`)
      .send({ amount: 50, concept: 'e2e-editado' })
      .expect(200);
    expect(res.body.concept).toBe('e2e-editado');
    expect(res.body.accountAmount).toBe('50');
  });

  it('PATCH cambia la moneda y recalcula accountAmount → 200', async () => {
    const created = await createTransaction();
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/transactions/${created.id}`)
      .send({ currency: 'USD', amount: 50 })
      .expect(200);
    expect(res.body.currency).toBe('USD');
    expect(res.body.accountAmount).toBe('45.98');
    expect(res.body.exchangeRate).toBe('0.9195');
  });

  it('PATCH inválido → 400', async () => {
    const created = await createTransaction();
    await request(app.getHttpServer())
      .patch(`/api/v1/transactions/${created.id}`)
      .send({ amount: 0 })
      .expect(400);
  });

  it('PATCH id inexistente → 404', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/transactions/${MISSING_ID}`)
      .send({ concept: 'e2e-x' })
      .expect(404);
  });

  it('PATCH id mal formado → 400', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/transactions/no-es-uuid')
      .send({ concept: 'e2e-x' })
      .expect(400);
  });

  it('DELETE → 200', async () => {
    const created = await createTransaction();
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/transactions/${created.id}`)
      .expect(200);
    expect(res.body.id).toBe(created.id);
  });

  it('DELETE id inexistente → 404', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/transactions/${MISSING_ID}`)
      .expect(404);
  });

  it('DELETE id mal formado → 400', async () => {
    await request(app.getHttpServer())
      .delete('/api/v1/transactions/no-es-uuid')
      .expect(400);
  });
});