import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../app.module.js';
import { setupApp } from '../app.setup.js';
import { PrismaService } from '../prisma/prisma.service.js';

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

describe('Accounts (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const uniqueName = () => `e2e-${randomUUID()}`;

  const createAccount = async (overrides = {}) => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .send({ name: uniqueName(), currency: 'EUR', ...overrides })
      .expect(201);
    return res.body;
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.account.deleteMany({ where: { name: { startsWith: 'e2e-' } } });
    await app.close();
  });

  it('GET /api/v1/accounts → 200 paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/accounts')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
  });

  it('GET /api/v1/accounts?page=0 → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/accounts?page=0')
      .expect(400);
  });

  it('POST válido → 201 con currentBalance', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .send({ name: uniqueName(), initialBalance: 100.5, currency: 'USD' })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.currentBalance).toBe('100.5');
  });

  it('POST inválido → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .send({ name: '', currency: 'GBP' })
      .expect(400);
  });

  it('POST con campo no permitido → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .send({ name: uniqueName(), currency: 'EUR', foo: 'bar' })
      .expect(400);
  });

  it('POST con nombre de más de 80 caracteres → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .send({ name: 'e2e-' + 'a'.repeat(81), currency: 'EUR' })
      .expect(400);
  });

  it('POST duplicado → 409', async () => {
    const name = uniqueName();
    await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .send({ name, currency: 'EUR' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .send({ name, currency: 'EUR' })
      .expect(409);
  });

  it('GET id existente → 200', async () => {
    const created = await createAccount();

    const res = await request(app.getHttpServer())
      .get(`/api/v1/accounts/${created.id}`)
      .expect(200);

    expect(res.body.id).toBe(created.id);
    expect(res.body).toHaveProperty('currentBalance');
  });

  it('GET id inexistente → 404', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/accounts/${MISSING_ID}`)
      .expect(404);
  });

  it('GET id mal formado → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/accounts/no-es-uuid')
      .expect(400);
  });

  it('PATCH válido → 200', async () => {
    const created = await createAccount();

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/accounts/${created.id}`)
      .send({ name: 'e2e-actualizada', initialBalance: 50 })
      .expect(200);

    expect(res.body.name).toBe('e2e-actualizada');
    expect(res.body.currentBalance).toBe('50');
  });

  it('PATCH con currency → 400 (no editable)', async () => {
    const created = await createAccount();

    await request(app.getHttpServer())
      .patch(`/api/v1/accounts/${created.id}`)
      .send({ currency: 'GBP' })
      .expect(400);
  });

  it('PATCH con campo no permitido → 400', async () => {
    const created = await createAccount();

    await request(app.getHttpServer())
      .patch(`/api/v1/accounts/${created.id}`)
      .send({ foo: 'bar' })
      .expect(400);
  });

  it('PATCH id inexistente → 404', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/accounts/${MISSING_ID}`)
      .send({ name: 'e2e-x' })
      .expect(404);
  });

  it('DELETE archiva → 200', async () => {
    const created = await createAccount();

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/accounts/${created.id}`)
      .expect(200);

    expect(res.body.isArchived).toBe(true);
  });

  it('DELETE id inexistente → 404', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/accounts/${MISSING_ID}`)
      .expect(404);
  });

  it('PATCH restore → 200', async () => {
    const created = await createAccount();
    await request(app.getHttpServer())
      .delete(`/api/v1/accounts/${created.id}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/accounts/${created.id}/restore`)
      .expect(200);

    expect(res.body.isArchived).toBe(false);
  });

  it('PATCH restore id inexistente → 404', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/accounts/${MISSING_ID}/restore`)
      .expect(404);
  });

  it('GET /api/v1/accounts?limit=2 → respeta el límite', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/accounts?limit=2')
      .expect(200);

    expect(res.body.limit).toBe(2);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
  });

  it('GET /api/v1/accounts?limit=1000 → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/accounts?limit=1000')
      .expect(400);
  });

  it('POST initialBalance con más de 2 decimales → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .send({ name: uniqueName(), initialBalance: 1.234, currency: 'EUR' })
      .expect(400);
  });

  it('POST initialBalance negativo → 201 (permitido)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .send({ name: uniqueName(), initialBalance: -50, currency: 'EUR' })
      .expect(201);

    expect(res.body.currentBalance).toBe('-50');
  });

  it('PATCH id mal formado → 400', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/accounts/no-es-uuid')
      .send({ name: 'e2e-x' })
      .expect(400);
  });

  it('DELETE id mal formado → 400', async () => {
    await request(app.getHttpServer())
      .delete('/api/v1/accounts/no-es-uuid')
      .expect(400);
  });

  it('PATCH restore id mal formado → 400', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/accounts/no-es-uuid/restore')
      .expect(400);
  });

  it('POST normaliza el nombre (trim y espacios internos)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .send({ name: '  e2e-   Normalizada  ', currency: 'EUR' })
      .expect(201);

    expect(res.body.name).toBe('e2e- Normalizada');
  });

  it('PATCH normaliza el nombre', async () => {
    const created = await createAccount();

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/accounts/${created.id}`)
      .send({ name: '  e2e-Editada  ' })
      .expect(200);

    expect(res.body.name).toBe('e2e-Editada');
  });
});