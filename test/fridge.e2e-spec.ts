import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { UserIngredient } from '../src/fridge/entities/user-ingredient.entity.js';
import { Ingredient } from '../src/ingredients/entities/ingredient.entity.js';
import { RECIPES } from '../src/seed/data/recipes.data.js';
import { createTestApp } from './support/test-app.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

interface Suggestion {
  recipe: { id: string; name: string; category: { id: string; name: string } };
  matchedIngredients: number;
  totalIngredients: number;
  missingIngredients: { id: string; name: string }[];
  canPrepare: boolean;
}

// "Pollo con arroz y brócoli" usa: pollo, arroz blanco, brócoli, aceite de oliva y ajo
const POLLO_CON_ARROZ = RECIPES.find(
  (r) => r.name === 'Pollo con arroz y brócoli',
)!;

describe('Nevera (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const http = () => request(app.getHttpServer());

  let nuriaId: string;
  let nuriaToken: string;
  let otroToken: string;
  let adminToken: string;
  const ids = new Map<string, string>();

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const registerAndLogin = async (email: string) => {
    const password = 'password123';
    const created = await http()
      .post('/auth/register')
      .send({ email, password })
      .expect(201);
    const login = await http()
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return {
      id: created.body.id as string,
      token: login.body.accessToken as string,
    };
  };

  const add = (name: string, token = nuriaToken) =>
    http()
      .post('/fridge')
      .set(auth(token))
      .send({ ingredientId: ids.get(name) });

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    await http()
      .post('/seed')
      .set('x-seed-key', process.env.SEED_KEY as string)
      .expect(201);

    ({ id: nuriaId, token: nuriaToken } =
      await registerAndLogin('nuria@example.com'));
    ({ token: otroToken } = await registerAndLogin('otro@example.com'));
    const adminLogin = await http()
      .post('/auth/login')
      .send({
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
      })
      .expect(200);
    adminToken = adminLogin.body.accessToken;

    for (const ingredient of await dataSource
      .getRepository(Ingredient)
      .find()) {
      ids.set(ingredient.name, ingredient.id);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Acceso', () => {
    it.each([
      ['get', '/fridge'],
      ['post', '/fridge'],
      ['delete', `/fridge/${MISSING_ID}`],
      ['get', '/fridge/suggestions'],
    ] as const)('%s %s responde 401 sin token', async (method, path) => {
      await http()[method](path).expect(401);
    });

    it.each([
      ['get', '/fridge'],
      ['post', '/fridge'],
      ['delete', `/fridge/${MISSING_ID}`],
      ['get', '/fridge/suggestions'],
    ] as const)(
      '%s %s responde 403 para un admin (es solo para usuarios)',
      async (method, path) => {
        await http()[method](path).set(auth(adminToken)).expect(403);
      },
    );
  });

  describe('Nevera vacía', () => {
    it('GET /fridge devuelve una lista vacía', async () => {
      const res = await http().get('/fridge').set(auth(nuriaToken)).expect(200);

      expect(res.body).toEqual([]);
    });

    it('GET /fridge/suggestions devuelve una lista vacía', async () => {
      const res = await http()
        .get('/fridge/suggestions?maxMissing=5')
        .set(auth(nuriaToken))
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe('POST /fridge', () => {
    it('agrega un ingrediente y lo devuelve', async () => {
      const res = await add('Pechuga de pollo').expect(201);

      expect(res.body).toEqual({
        ingredientId: ids.get('Pechuga de pollo'),
        name: 'Pechuga de pollo',
      });
      expect(
        await dataSource
          .getRepository(UserIngredient)
          .countBy({ userId: nuriaId }),
      ).toBe(1);
    });

    it('responde 409 si el ingrediente ya está en la nevera', async () => {
      const res = await add('Pechuga de pollo').expect(409);

      expect(res.body.message).toBe('El ingrediente ya está en tu nevera');
    });

    it('otro usuario puede tener el mismo ingrediente en su nevera', async () => {
      await add('Pechuga de pollo', otroToken).expect(201);
    });

    it('responde 404 si el ingrediente no existe', async () => {
      await http()
        .post('/fridge')
        .set(auth(nuriaToken))
        .send({ ingredientId: MISSING_ID })
        .expect(404);
    });

    it.each([
      ['sin ingredientId', {}],
      ['ingredientId que no es UUID', { ingredientId: 'arroz' }],
      ['campos que no existen', { ingredientId: MISSING_ID, quantity: 2 }],
      ['una lista de ids', { ingredientIds: [MISSING_ID] }],
    ])('responde 400 con %s', async (_caso, body) => {
      await http().post('/fridge').set(auth(nuriaToken)).send(body).expect(400);
    });
  });

  describe('GET /fridge', () => {
    it('devuelve solo los ingredientes del usuario, ordenados por nombre', async () => {
      await add('Arroz blanco').expect(201);
      await add('Brócoli').expect(201);

      const res = await http().get('/fridge').set(auth(nuriaToken)).expect(200);

      expect(res.body.map((i: { name: string }) => i.name)).toEqual([
        'Arroz blanco',
        'Brócoli',
        'Pechuga de pollo',
      ]);
      const otro = await http().get('/fridge').set(auth(otroToken)).expect(200);
      expect(otro.body).toHaveLength(1);
    });
  });

  describe('GET /fridge/suggestions', () => {
    // La nevera tiene pollo, arroz y brócoli: a "Pollo con arroz y brócoli" le faltan aceite y ajo
    it('por defecto solo sugiere recetas completas (aquí ninguna)', async () => {
      const res = await http()
        .get('/fridge/suggestions')
        .set(auth(nuriaToken))
        .expect(200);

      expect(res.body.every((s: Suggestion) => s.canPrepare)).toBe(true);
      expect(res.body.map((s: Suggestion) => s.recipe.name)).not.toContain(
        POLLO_CON_ARROZ.name,
      );
    });

    it('con maxMissing=2 incluye la receta y dice qué le falta', async () => {
      const res = await http()
        .get('/fridge/suggestions?maxMissing=2')
        .set(auth(nuriaToken))
        .expect(200);

      const suggestion = (res.body as Suggestion[]).find(
        (s) => s.recipe.name === POLLO_CON_ARROZ.name,
      );
      expect(suggestion).toMatchObject({
        matchedIngredients: 3,
        totalIngredients: POLLO_CON_ARROZ.ingredients.length,
        canPrepare: false,
      });
      expect(suggestion?.missingIngredients.map((i) => i.name).sort()).toEqual([
        'Aceite de oliva',
        'Ajo',
      ]);
      expect(suggestion?.recipe.category.name).toBeDefined();
      for (const s of res.body as Suggestion[]) {
        expect(s.missingIngredients.length).toBeLessThanOrEqual(2);
        expect(s.matchedIngredients).toBeGreaterThan(0);
      }
    });

    it('al completar los ingredientes la receta se puede preparar y sale primero', async () => {
      await add('Aceite de oliva').expect(201);
      await add('Ajo').expect(201);

      const res = await http()
        .get('/fridge/suggestions')
        .set(auth(nuriaToken))
        .expect(200);

      expect(res.body[0]).toMatchObject({
        recipe: { name: POLLO_CON_ARROZ.name },
        canPrepare: true,
        missingIngredients: [],
      });
    });

    it('ordena por ingredientes faltantes', async () => {
      const res = await http()
        .get('/fridge/suggestions?maxMissing=5')
        .set(auth(nuriaToken))
        .expect(200);

      const missing = (res.body as Suggestion[]).map(
        (s) => s.missingIngredients.length,
      );
      expect(missing).toEqual([...missing].sort((a, b) => a - b));
    });

    it.each(['-1', '6', '1.5', 'muchos'])(
      'responde 400 con maxMissing=%s',
      async (value) => {
        await http()
          .get(`/fridge/suggestions?maxMissing=${value}`)
          .set(auth(nuriaToken))
          .expect(400);
      },
    );
  });

  describe('DELETE /fridge/:ingredientId', () => {
    it('quita el ingrediente (204) y la receta deja de poder prepararse', async () => {
      await http()
        .delete(`/fridge/${ids.get('Ajo')}`)
        .set(auth(nuriaToken))
        .expect(204);

      const res = await http()
        .get('/fridge/suggestions')
        .set(auth(nuriaToken))
        .expect(200);
      expect(res.body.map((s: Suggestion) => s.recipe.name)).not.toContain(
        POLLO_CON_ARROZ.name,
      );
    });

    it('responde 404 si el ingrediente no está en la nevera y 400 si el id no es un UUID', async () => {
      await http()
        .delete(`/fridge/${ids.get('Ajo')}`)
        .set(auth(nuriaToken))
        .expect(404);
      await http().delete('/fridge/ajo').set(auth(nuriaToken)).expect(400);
    });

    it('no afecta la nevera de otro usuario', async () => {
      await http()
        .delete(`/fridge/${ids.get('Pechuga de pollo')}`)
        .set(auth(nuriaToken))
        .expect(204);

      const otro = await http().get('/fridge').set(auth(otroToken)).expect(200);
      expect(otro.body).toEqual([
        { ingredientId: ids.get('Pechuga de pollo'), name: 'Pechuga de pollo' },
      ]);
    });
  });
});
