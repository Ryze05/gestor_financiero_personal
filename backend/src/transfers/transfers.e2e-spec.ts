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
const TRANSFER_DATE = '2000-01-15';

const fxStub = {
  getRate: async (from: string, to: string) =>
    new Prisma.Decimal(from === 'EUR' && to === 'USD' ? '1.08' : '0.9195'),
  convert: (amount: Prisma.Decimal, rate: Prisma.Decimal) =>
    amount.times(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
};

describe('Transfers (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let eurAccountId: string;
  let otherEurAccountId: string;
  let usdAccountId: string;

  const post = (path: string, body: object) =>
    request(app.getHttpServer()).post(path).send(body);
  const get = (path: string) => request(app.getHttpServer()).get(path);
  const patch = (path: string, body: object) =>
    request(app.getHttpServer()).patch(path).send(body);
  const del = (path: string) => request(app.getHttpServer()).delete(path);

  const uniqueName = () => `e2e-${randomUUID()}`;

  const validTransfer = (overrides: object = {}) => ({
    amount: 25,
    date: TRANSFER_DATE,
    concept: uniqueName(),
    sourceAccountId: eurAccountId,
    destinationAccountId: otherEurAccountId,
    ...overrides,
  });

  const createTransfer = async (overrides: object = {}) =>
    (await post('/api/v1/transfers', validTransfer(overrides)).expect(201))
      .body;

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

    eurAccountId = (
      await post('/api/v1/accounts', {
        name: uniqueName(),
        currency: 'EUR',
      }).expect(201)
    ).body.id;
    otherEurAccountId = (
      await post('/api/v1/accounts', {
        name: uniqueName(),
        currency: 'EUR',
      }).expect(201)
    ).body.id;
    usdAccountId = (
      await post('/api/v1/accounts', {
        name: uniqueName(),
        currency: 'USD',
      }).expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({
      where: { concept: { startsWith: 'e2e-' } },
    });
    await prisma.transfer.deleteMany({
      where: { concept: { startsWith: 'e2e-' } },
    });
    await prisma.account.deleteMany({
      where: { name: { startsWith: 'e2e-' } },
    });
    await app.close();
  });

  it('POST crea la transferencia y sus dos movimientos enlazados → 201', async () => {
    const created = await createTransfer();

    const detail = await get(`/api/v1/transfers/${created.id}`).expect(200);
    expect(detail.body.transactions).toHaveLength(2);

    const types = detail.body.transactions.map((t: { type: string }) => t.type);
    expect(types).toContain('EXPENSE');
    expect(types).toContain('INCOME');
    for (const transaction of detail.body.transactions) {
      expect(transaction.transferId).toBe(created.id);
    }
  });

  it('GET paginado → 200', async () => {
    const res = await get('/api/v1/transfers').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });

  it('GET filtra por search', async () => {
    const created = await createTransfer();
    const res = await get(
      `/api/v1/transfers?search=${created.concept}`,
    ).expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(created.id);
  });

  it('GET :id inexistente → 404', async () => {
    await get(`/api/v1/transfers/${MISSING_ID}`).expect(404);
  });

  it('GET :id no uuid → 400', async () => {
    await get('/api/v1/transfers/not-a-uuid').expect(400);
  });

  it('rechaza cuentas iguales → 400', async () => {
    await post(
      '/api/v1/transfers',
      validTransfer({ destinationAccountId: eurAccountId }),
    ).expect(400);
  });

  it('POST convierte cuando las monedas difieren → 201', async () => {
    const created = await createTransfer({
      amount: 100,
      sourceAccountId: eurAccountId,
      destinationAccountId: usdAccountId,
    });

    expect(created.destinationAmount).toBe('108');
    expect(created.destinationCurrency).toBe('USD');
    expect(created.exchangeRate).toBe('1.08');

    const detail = await get(`/api/v1/transfers/${created.id}`).expect(200);
    const income = detail.body.transactions.find(
      (t: { type: string }) => t.type === 'INCOME',
    );
    expect(income.accountId).toBe(usdAccountId);
    expect(income.amount).toBe('108');
    expect(income.currency).toBe('USD');
    expect(income.accountAmount).toBe('108');
  });

  it('rechaza cuenta inexistente → 400', async () => {
    await post(
      '/api/v1/transfers',
      validTransfer({ sourceAccountId: MISSING_ID }),
    ).expect(400);
  });

  it('rechaza cuenta archivada → 400', async () => {
    const archived = await post('/api/v1/accounts', {
      name: uniqueName(),
      currency: 'EUR',
    }).expect(201);
    await del(`/api/v1/accounts/${archived.body.id}`).expect(200);

    await post(
      '/api/v1/transfers',
      validTransfer({ sourceAccountId: archived.body.id }),
    ).expect(400);
  });

  it('rechaza body invalido → 400', async () => {
    await post('/api/v1/transfers', validTransfer({ amount: 'mucho' })).expect(
      400,
    );
    await post(
      '/api/v1/transfers',
      validTransfer({ sourceAccountId: 'not-a-uuid' }),
    ).expect(400);
    await post(
      '/api/v1/transfers',
      validTransfer({ unknownField: true }),
    ).expect(400);
  });

  it('los movimientos de la transferencia NO cuentan en el dashboard', async () => {
    await createTransfer({ date: TRANSFER_DATE });

    const dashboard = await get(
      `/api/v1/dashboard?accountId=${eurAccountId}&from=${TRANSFER_DATE}&to=${TRANSFER_DATE}`,
    ).expect(200);

    expect(dashboard.body.count).toBe(0);
    expect(dashboard.body.income).toBe('0');
    expect(dashboard.body.expense).toBe('0');
  });

  it('no permite borrar un movimiento de una transferencia → 409', async () => {
    const created = await createTransfer();
    const detail = await get(`/api/v1/transfers/${created.id}`).expect(200);
    const transactionId = detail.body.transactions[0].id;

    await del(`/api/v1/transactions/${transactionId}`).expect(409);
  });

  it('PATCH actualiza la transferencia y sus dos movimientos → 200', async () => {
    const created = await createTransfer();
    const concept = uniqueName();

    const patched = await patch(`/api/v1/transfers/${created.id}`, {
      amount: 75,
      concept,
    }).expect(200);

    expect(patched.body.amount).toBe('75');
    expect(patched.body.concept).toBe(concept);

    const detail = await get(`/api/v1/transfers/${created.id}`).expect(200);
    expect(detail.body.amount).toBe('75');
    for (const transaction of detail.body.transactions) {
      expect(transaction.amount).toBe('75');
      expect(transaction.concept).toBe(concept);
    }
  });

  it('PATCH cambia las cuentas y mueve los movimientos → 200', async () => {
    const created = await createTransfer();
    const third = await post('/api/v1/accounts', {
      name: uniqueName(),
      currency: 'EUR',
    }).expect(201);

    await patch(`/api/v1/transfers/${created.id}`, {
      destinationAccountId: third.body.id,
    }).expect(200);

    const detail = await get(`/api/v1/transfers/${created.id}`).expect(200);
    expect(detail.body.destinationAccountId).toBe(third.body.id);
    const income = detail.body.transactions.find(
      (t: { type: string }) => t.type === 'INCOME',
    );
    expect(income.accountId).toBe(third.body.id);
  });

  it('PATCH ajusta los saldos de las cuentas de origen y destino', async () => {
    const created = await createTransfer({ amount: 25 });

    const before = await get('/api/v1/accounts').expect(200);
    const sourceBefore = before.body.data.find(
      (a: { id: string }) => a.id === eurAccountId,
    ).currentBalance;
    const destBefore = before.body.data.find(
      (a: { id: string }) => a.id === otherEurAccountId,
    ).currentBalance;

    await patch(`/api/v1/transfers/${created.id}`, { amount: 60 }).expect(200);

    const after = await get('/api/v1/accounts').expect(200);
    const sourceAfter = after.body.data.find(
      (a: { id: string }) => a.id === eurAccountId,
    ).currentBalance;
    const destAfter = after.body.data.find(
      (a: { id: string }) => a.id === otherEurAccountId,
    ).currentBalance;

    expect(Number(sourceAfter)).toBe(Number(sourceBefore) - 35);
    expect(Number(destAfter)).toBe(Number(destBefore) + 35);
  });

  it('PATCH convierte al cambiar a una cuenta de otra moneda → 200', async () => {
    const created = await createTransfer();

    await patch(`/api/v1/transfers/${created.id}`, {
      destinationAccountId: usdAccountId,
      amount: 100,
    }).expect(200);

    const detail = await get(`/api/v1/transfers/${created.id}`).expect(200);
    expect(detail.body.destinationAccountId).toBe(usdAccountId);
    expect(detail.body.destinationAmount).toBe('108');
    expect(detail.body.exchangeRate).toBe('1.08');

    const income = detail.body.transactions.find(
      (t: { type: string }) => t.type === 'INCOME',
    );
    expect(income.accountId).toBe(usdAccountId);
    expect(income.amount).toBe('108');
    expect(income.currency).toBe('USD');
  });

  it('PATCH rechaza body invalido → 400', async () => {
    const created = await createTransfer();

    await patch(`/api/v1/transfers/${created.id}`, { amount: 'mucho' }).expect(
      400,
    );
    await patch(`/api/v1/transfers/${created.id}`, { unknownField: true }).expect(
      400,
    );
  });

  it('PATCH :id inexistente → 404', async () => {
    await patch(`/api/v1/transfers/${MISSING_ID}`, { amount: 5 }).expect(404);
  });

  it('PATCH :id no uuid → 400', async () => {
    await patch('/api/v1/transfers/not-a-uuid', { amount: 5 }).expect(400);
  });

  it('DELETE borra la transferencia y sus movimientos (cascada)', async () => {
    const created = await createTransfer();

    await del(`/api/v1/transfers/${created.id}`).expect(200);
    await get(`/api/v1/transfers/${created.id}`).expect(404);

    const movements = await get(
      `/api/v1/transactions?search=${created.concept}`,
    ).expect(200);
    expect(movements.body.total).toBe(0);
  });

  it('DELETE :id inexistente → 404', async () => {
    await del(`/api/v1/transfers/${MISSING_ID}`).expect(404);
  });

  it('DELETE :id no uuid → 400', async () => {
    await del('/api/v1/transfers/not-a-uuid').expect(400);
  });
});
