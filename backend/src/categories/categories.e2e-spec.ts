import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../app.module.js';
import { setupApp } from '../app.setup.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { App } from 'supertest/types.js';

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

describe('Categories (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const uniqueName = () => `e2e-${randomUUID()}`;

  const createCategory = async (overrides = {}) => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .send({ name: uniqueName(), type: 'EXPENSE', ...overrides })
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
    await prisma.category.deleteMany({ where: { name: { startsWith: 'e2e-' } } });
    await app.close();
  });

  it('GET /api/v1/categories → 200 paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/categories')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
  });

  it('GET /api/v1/categories?limit=2 → respeta el límite', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/categories?limit=2')
      .expect(200);

    expect(res.body.limit).toBe(2);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
  });

  it('GET /api/v1/categories?page=0 → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/categories?page=0')
      .expect(400);
  });

  it('GET /api/v1/categories?limit=1000 → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/categories?limit=1000')
      .expect(400);
  });

  it('POST válido → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .send({ name: uniqueName(), type: 'EXPENSE', color: '#123456' })
      .expect(201);
    expect(res.body).toHaveProperty('id');
  });

  it('POST inválido → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/categories')
      .send({ name: '', type: 'NO_EXISTE' })
      .expect(400);
  });

  it('POST con campo no permitido → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/categories')
      .send({ name: uniqueName(), type: 'EXPENSE', foo: 'bar' })
      .expect(400);
  });

  it('POST duplicado → 409', async () => {
    const name = uniqueName();
    await request(app.getHttpServer())
      .post('/api/v1/categories')
      .send({ name, type: 'EXPENSE' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/categories')
      .send({ name, type: 'EXPENSE' })
      .expect(409);
  });

  it('GET id existente → 200', async () => {
    const created = await createCategory();

    const res = await request(app.getHttpServer())
      .get(`/api/v1/categories/${created.id}`)
      .expect(200);

    expect(res.body.id).toBe(created.id);
    expect(res.body).toHaveProperty('name');
  });

  it('GET id inexistente → 404', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/categories/${MISSING_ID}`)
      .expect(404);
  });

  it('PATCH válido → 200', async () => {
    const created = await createCategory();

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/categories/${created.id}`)
      .send({ name: 'e2e-actualizada', color: '#abcdef' })
      .expect(200);

    expect(res.body.name).toBe('e2e-actualizada');
    expect(res.body.color).toBe('#abcdef');
  });

  it('PATCH inválido → 400', async () => {
    const created = await createCategory();

    await request(app.getHttpServer())
      .patch(`/api/v1/categories/${created.id}`)
      .send({ type: 'NO_EXISTE' })
      .expect(400);
  });

  it('PATCH id inexistente → 404', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/categories/${MISSING_ID}`)
      .send({ name: 'e2e-x' })
      .expect(404);
  });

  it('DELETE archiva → 200', async () => {
    const created = await createCategory();

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/categories/${created.id}`)
      .expect(200);

    expect(res.body.isArchived).toBe(true);
  });

  it('DELETE id inexistente → 404', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/categories/${MISSING_ID}`)
      .expect(404);
  });

  it('PATCH restore → 200', async () => {
    const created = await createCategory();
    await request(app.getHttpServer())
      .delete(`/api/v1/categories/${created.id}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/categories/${created.id}/restore`)
      .expect(200);

    expect(res.body.isArchived).toBe(false);
  });

  it('PATCH restore id inexistente → 404', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/categories/${MISSING_ID}/restore`)
      .expect(404);
  });

  it('GET id mal formado → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/categories/no-es-uuid')
      .expect(400);
  });

  it('PATCH id mal formado → 400', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/categories/no-es-uuid')
      .send({ name: 'e2e-x' })
      .expect(400);
  });

  it('DELETE id mal formado → 400', async () => {
    await request(app.getHttpServer())
      .delete('/api/v1/categories/no-es-uuid')
      .expect(400);
  });

  it('PATCH restore id mal formado → 400', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/categories/no-es-uuid/restore')
      .expect(400);
  });
});