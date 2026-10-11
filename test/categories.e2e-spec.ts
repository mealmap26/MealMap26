import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Category } from '../src/categories/entities/category.entity.js';
import { CATEGORIES } from '../src/seed/data/categories.data.js';
import { createTestApp } from './support/test-app.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

describe('Categorías (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const http = () => request(app.getHttpServer());

  let userToken: string;
  let adminToken: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    await http()
      .post('/seed')
      .set('x-seed-key', process.env.SEED_KEY as string)
      .expect(201);

    const password = 'password123';
    await http()
      .post('/auth/register')
      .send({ email: 'cata@example.com', password })
      .expect(201);
    const login = await http()
      .post('/auth/login')
      .send({ email: 'cata@example.com', password })
      .expect(200);
    userToken = login.body.accessToken;

    const adminLogin = await http()
      .post('/auth/login')
      .send({
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
      })
      .expect(200);
    adminToken = adminLogin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Acceso', () => {
    it.each([
      ['get', '/categories'],
      ['get', `/categories/${MISSING_ID}`],
      ['post', '/categories'],
      ['patch', `/categories/${MISSING_ID}`],
      ['delete', `/categories/${MISSING_ID}`],
    ] as const)('%s %s responde 401 sin token', async (method, path) => {
      await http()[method](path).expect(401);
    });

    it.each([
      ['post', '/categories'],
      ['patch', `/categories/${MISSING_ID}`],
      ['delete', `/categories/${MISSING_ID}`],
    ] as const)('%s %s responde 403 para un USER', async (method, path) => {
      await http()
        [method](path)
        .set(auth(userToken))
        .send({ name: 'Nueva' })
        .expect(403);
    });
  });

  describe('GET /categories', () => {
    it('un USER ve las categorías del seed ordenadas por nombre', async () => {
      const res = await http()
        .get('/categories')
        .set(auth(userToken))
        .expect(200);

      const names = res.body.map((c: Category) => c.name);
      expect(names).toEqual([...CATEGORIES].sort((a, b) => a.localeCompare(b)));
      expect(Object.keys(res.body[0]).sort()).toEqual(['id', 'name']);
    });

    it('GET /categories/:id devuelve una categoría', async () => {
      const desayuno = await dataSource
        .getRepository(Category)
        .findOneByOrFail({ name: 'Desayuno' });

      const res = await http()
        .get(`/categories/${desayuno.id}`)
        .set(auth(userToken))
        .expect(200);

      expect(res.body).toEqual({ id: desayuno.id, name: 'Desayuno' });
    });

    it('responde 404 si no existe y 400 si el id no es un UUID', async () => {
      await http()
        .get(`/categories/${MISSING_ID}`)
        .set(auth(userToken))
        .expect(404);
      await http().get('/categories/abc').set(auth(userToken)).expect(400);
    });
  });

  describe('POST, PATCH y DELETE (ADMIN)', () => {
    let createdId: string;

    it('crea una categoría quitando los espacios del nombre', async () => {
      const res = await http()
        .post('/categories')
        .set(auth(adminToken))
        .send({ name: '  Sin gluten  ' })
        .expect(201);

      expect(res.body).toEqual({ id: expect.any(String), name: 'Sin gluten' });
      createdId = res.body.id;
    });

    it.each([
      ['sin nombre', {}],
      ['nombre de una letra', { name: 'A' }],
      ['nombre solo con espacios', { name: '    ' }],
      ['nombre muy largo', { name: 'x'.repeat(61) }],
      ['nombre que no es texto', { name: 123 }],
      ['campos que no existen', { name: 'Postres', color: 'rojo' }],
    ])('responde 400 con %s', async (_caso, body) => {
      await http()
        .post('/categories')
        .set(auth(adminToken))
        .send(body)
        .expect(400);
    });

    it('responde 409 si el nombre ya existe, sin importar mayúsculas', async () => {
      const res = await http()
        .post('/categories')
        .set(auth(adminToken))
        .send({ name: 'sin GLUTEN' })
        .expect(409);

      expect(res.body.message).toBe('Ya existe una categoría con ese nombre');
    });

    it('renombra la categoría', async () => {
      const res = await http()
        .patch(`/categories/${createdId}`)
        .set(auth(adminToken))
        .send({ name: 'Libre de gluten' })
        .expect(200);

      expect(res.body).toEqual({ id: createdId, name: 'Libre de gluten' });
    });

    it('al renombrar responde 409 si el nombre es de otra categoría', async () => {
      await http()
        .patch(`/categories/${createdId}`)
        .set(auth(adminToken))
        .send({ name: 'snack' })
        .expect(409);
    });

    it('al renombrar responde 400 si el nombre es null', async () => {
      await http()
        .patch(`/categories/${createdId}`)
        .set(auth(adminToken))
        .send({ name: null })
        .expect(400);
    });

    it('al renombrar responde 404 si no existe', async () => {
      await http()
        .patch(`/categories/${MISSING_ID}`)
        .set(auth(adminToken))
        .send({ name: 'Otra' })
        .expect(404);
    });

    it('responde 409 al eliminar una categoría con recetas', async () => {
      const desayuno = await dataSource
        .getRepository(Category)
        .findOneByOrFail({ name: 'Desayuno' });

      await http()
        .delete(`/categories/${desayuno.id}`)
        .set(auth(adminToken))
        .expect(409);
    });

    it('elimina una categoría sin recetas (204) y luego responde 404', async () => {
      await http()
        .delete(`/categories/${createdId}`)
        .set(auth(adminToken))
        .expect(204);

      expect(
        await dataSource.getRepository(Category).existsBy({ id: createdId }),
      ).toBe(false);
      await http()
        .delete(`/categories/${createdId}`)
        .set(auth(adminToken))
        .expect(404);
    });
  });
});
