import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { UserIngredient } from '../src/fridge/entities/user-ingredient.entity.js';
import { Ingredient } from '../src/ingredients/entities/ingredient.entity.js';
import { Recipe } from '../src/recipes/entities/recipe.entity.js';
import { INGREDIENTS } from '../src/seed/data/ingredients.data.js';
import { createTestApp } from './support/test-app.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';
// 3 huevos (150 g) + espinaca + pan integral + aceite, 1 porción
const PERICOS = 'Huevos revueltos con espinaca y pan integral';

describe('Ingredientes (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const http = () => request(app.getHttpServer());

  let userId: string;
  let userToken: string;
  let adminToken: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const quinua = {
    name: 'Quinua roja',
    caloriesPer100g: 368,
    proteinPer100g: 14.1,
    carbsPer100g: 64.2,
    fatPer100g: 6.1,
  };

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    await http().post('/seed').set('x-seed-key', process.env.SEED_KEY as string).expect(201);

    const password = 'password123';
    const created = await http().post('/auth/register').send({ email: 'ines@example.com', password }).expect(201);
    userId = created.body.id;
    const login = await http().post('/auth/login').send({ email: 'ines@example.com', password }).expect(200);
    userToken = login.body.accessToken;

    const adminLogin = await http()
      .post('/auth/login')
      .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
      .expect(200);
    adminToken = adminLogin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const findByName = (name: string) =>
    dataSource.getRepository(Ingredient).findOneByOrFail({ name });

  describe('Acceso', () => {
    it.each([
      ['get', '/ingredients'],
      ['get', `/ingredients/${MISSING_ID}`],
      ['post', '/ingredients'],
      ['patch', `/ingredients/${MISSING_ID}`],
      ['delete', `/ingredients/${MISSING_ID}`],
    ] as const)('%s %s responde 401 sin token', async (method, path) => {
      await http()[method](path).expect(401);
    });

    it.each([
      ['post', '/ingredients'],
      ['patch', `/ingredients/${MISSING_ID}`],
      ['delete', `/ingredients/${MISSING_ID}`],
    ] as const)('%s %s responde 403 para un USER', async (method, path) => {
      await http()[method](path).set(auth(userToken)).send(quinua).expect(403);
    });
  });

  describe('GET /ingredients', () => {
    it('un USER ve todos los ingredientes ordenados por nombre', async () => {
      const res = await http().get('/ingredients').set(auth(userToken)).expect(200);

      expect(res.body).toHaveLength(INGREDIENTS.length);
      // Mismo orden que da la base (depende de su collation)
      const ordered = await dataSource.getRepository(Ingredient).find({ order: { name: 'ASC' } });
      expect(res.body.map((i: Ingredient) => i.name)).toEqual(ordered.map((i) => i.name));
    });

    it('el seed guarda gramsPerUnit (huevo 50 g, el pollo no tiene)', async () => {
      const res = await http().get('/ingredients?search=huevo').set(auth(userToken)).expect(200);

      expect(res.body).toEqual([
        expect.objectContaining({ name: 'Huevo', gramsPerUnit: 50, caloriesPer100g: 143 }),
      ]);
      expect((await findByName('Pechuga de pollo')).gramsPerUnit).toBeNull();
    });

    it('search no distingue mayúsculas y busca en cualquier parte del nombre', async () => {
      const res = await http().get('/ingredients?search=POLLO').set(auth(userToken)).expect(200);

      const expected = INGREDIENTS.filter((i) => i.name.toLowerCase().includes('pollo'));
      expect(res.body.length).toBeGreaterThan(1);
      expect(res.body.map((i: Ingredient) => i.name).sort()).toEqual(
        expected.map((i) => i.name).sort(),
      );
    });

    it('search con comodines de LIKE no devuelve todo', async () => {
      const res = await http().get('/ingredients?search=%25').set(auth(userToken)).expect(200);

      expect(res.body).toEqual([]);
    });

    it('GET /ingredients/:id devuelve el ingrediente, 404 si no existe y 400 si el id no es UUID', async () => {
      const huevo = await findByName('Huevo');

      const res = await http().get(`/ingredients/${huevo.id}`).set(auth(userToken)).expect(200);
      expect(res.body).toMatchObject({ id: huevo.id, name: 'Huevo' });

      await http().get(`/ingredients/${MISSING_ID}`).set(auth(userToken)).expect(404);
      await http().get('/ingredients/123').set(auth(userToken)).expect(400);
    });
  });

  describe('POST /ingredients', () => {
    it('crea un ingrediente (sin gramsPerUnit queda en null)', async () => {
      const res = await http().post('/ingredients').set(auth(adminToken)).send(quinua).expect(201);

      expect(res.body).toEqual({ id: expect.any(String), ...quinua, gramsPerUnit: null });
    });

    it('crea un ingrediente con gramsPerUnit', async () => {
      const res = await http()
        .post('/ingredients')
        .set(auth(adminToken))
        .send({ ...quinua, name: 'Kiwi', gramsPerUnit: 75 })
        .expect(201);

      expect(res.body.gramsPerUnit).toBe(75);
    });

    it.each([
      ['sin nombre', { ...quinua, name: undefined }],
      ['calorías negativas', { ...quinua, name: 'X1', caloriesPer100g: -1 }],
      ['calorías por encima de 900', { ...quinua, name: 'X2', caloriesPer100g: 901 }],
      ['más de 2 decimales', { ...quinua, name: 'X3', proteinPer100g: 1.234 }],
      ['macro que no es número', { ...quinua, name: 'X4', fatPer100g: 'mucha' }],
      ['falta un macro', { ...quinua, name: 'X5', carbsPer100g: undefined }],
      ['gramsPerUnit en 0', { ...quinua, name: 'X6', gramsPerUnit: 0 }],
      ['campos que no existen', { ...quinua, name: 'X7', price: 10 }],
    ])('responde 400 con %s', async (_caso, body) => {
      await http().post('/ingredients').set(auth(adminToken)).send(body).expect(400);
    });

    it('responde 409 si el nombre ya existe, sin importar mayúsculas', async () => {
      const res = await http()
        .post('/ingredients')
        .set(auth(adminToken))
        .send({ ...quinua, name: ' HUEVO ' })
        .expect(409);

      expect(res.body.message).toBe('Ya existe un ingrediente con ese nombre');
    });
  });

  describe('PATCH /ingredients/:id', () => {
    it('al cambiar las calorías recalcula los macros de las recetas que lo usan', async () => {
      const huevo = await findByName('Huevo');
      const before = await dataSource.getRepository(Recipe).findOneByOrFail({ name: PERICOS });

      const res = await http()
        .patch(`/ingredients/${huevo.id}`)
        .set(auth(adminToken))
        .send({ caloriesPer100g: 243 })
        .expect(200);

      expect(res.body).toMatchObject({ id: huevo.id, name: 'Huevo', caloriesPer100g: 243 });
      // +100 kcal por cada 100 g y la receta usa 150 g de huevo en 1 porción
      const after = await dataSource.getRepository(Recipe).findOneByOrFail({ name: PERICOS });
      expect(after.calories).toBeCloseTo(before.calories + 150, 2);
      expect(after.protein).toBeCloseTo(before.protein, 2);
    });

    it('al cambiar gramsPerUnit también recalcula', async () => {
      const huevo = await findByName('Huevo');
      const before = await dataSource.getRepository(Recipe).findOneByOrFail({ name: PERICOS });

      await http()
        .patch(`/ingredients/${huevo.id}`)
        .set(auth(adminToken))
        .send({ gramsPerUnit: 60 })
        .expect(200);

      // 3 huevos x 10 g más = 30 g más de huevo (243 kcal / 100 g)
      const after = await dataSource.getRepository(Recipe).findOneByOrFail({ name: PERICOS });
      expect(after.calories).toBeCloseTo(before.calories + 72.9, 2);
    });

    it("responde 400 y no cambia nada si se quita gramsPerUnit a un ingrediente usado en 'unidad'", async () => {
      const huevo = await findByName('Huevo');

      const res = await http()
        .patch(`/ingredients/${huevo.id}`)
        .set(auth(adminToken))
        .send({ gramsPerUnit: null, caloriesPer100g: 100 })
        .expect(400);

      expect(res.body.message).toContain('gramsPerUnit');
      // La transacción se revierte
      expect(await findByName('Huevo')).toMatchObject({ gramsPerUnit: 60, caloriesPer100g: 243 });
    });

    it('renombra y responde 409 si el nombre es de otro ingrediente', async () => {
      const kiwi = await findByName('Kiwi');

      await http()
        .patch(`/ingredients/${kiwi.id}`)
        .set(auth(adminToken))
        .send({ name: 'Kiwi dorado' })
        .expect(200);
      await http()
        .patch(`/ingredients/${kiwi.id}`)
        .set(auth(adminToken))
        .send({ name: 'leche' })
        .expect(409);
    });

    it('responde 400 con un valor fuera de rango y 404 si no existe', async () => {
      const kiwi = await findByName('Kiwi dorado');

      await http().patch(`/ingredients/${kiwi.id}`).set(auth(adminToken)).send({ fatPer100g: -3 }).expect(400);
      await http().patch(`/ingredients/${kiwi.id}`).set(auth(adminToken)).send({ name: null }).expect(400);
      await http().patch(`/ingredients/${kiwi.id}`).set(auth(adminToken)).send({ caloriesPer100g: null }).expect(400);
      await http().patch(`/ingredients/${MISSING_ID}`).set(auth(adminToken)).send({ fatPer100g: 3 }).expect(404);
    });
  });

  describe('DELETE /ingredients/:id', () => {
    it('responde 409 si el ingrediente está en una receta', async () => {
      const huevo = await findByName('Huevo');

      await http().delete(`/ingredients/${huevo.id}`).set(auth(adminToken)).expect(409);
    });

    it('elimina un ingrediente sin recetas (204) y lo quita de las neveras', async () => {
      const kiwi = await findByName('Kiwi dorado');
      await dataSource.getRepository(UserIngredient).save({ userId, ingredientId: kiwi.id });

      await http().delete(`/ingredients/${kiwi.id}`).set(auth(adminToken)).expect(204);

      expect(await dataSource.getRepository(Ingredient).existsBy({ id: kiwi.id })).toBe(false);
      expect(await dataSource.getRepository(UserIngredient).countBy({ userId })).toBe(0);
      await http().delete(`/ingredients/${kiwi.id}`).set(auth(adminToken)).expect(404);
    });
  });
});
