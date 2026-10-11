import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Category } from '../src/categories/entities/category.entity.js';
import { Ingredient } from '../src/ingredients/entities/ingredient.entity.js';
import { MealPlanEntry } from '../src/meal-plan/entities/meal-plan-entry.entity.js';
import { RecipeIngredient } from '../src/recipes/entities/recipe-ingredient.entity.js';
import { Recipe } from '../src/recipes/entities/recipe.entity.js';
import { Unit } from '../src/recipes/enums/unit.enum.js';
import { RECIPES } from '../src/seed/data/recipes.data.js';
import { createTestApp } from './support/test-app.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

interface RecipeBody {
  id: string;
  name: string;
  prepTimeMinutes: number;
  calories: number;
  protein: number;
  category: { id: string; name: string };
}

describe('Recetas (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const http = () => request(app.getHttpServer());

  let userToken: string;
  let adminToken: string;
  let desayunoId: string;
  let polloId: string;
  let huevoId: string;
  let arrozId: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    await http().post('/seed').set('x-seed-key', process.env.SEED_KEY as string).expect(201);

    const password = 'password123';
    await http().post('/auth/register').send({ email: 'rita@example.com', password }).expect(201);
    const login = await http().post('/auth/login').send({ email: 'rita@example.com', password }).expect(200);
    userToken = login.body.accessToken;

    const adminLogin = await http()
      .post('/auth/login')
      .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
      .expect(200);
    adminToken = adminLogin.body.accessToken;

    desayunoId = (await dataSource.getRepository(Category).findOneByOrFail({ name: 'Desayuno' })).id;
    const ingredients = dataSource.getRepository(Ingredient);
    polloId = (await ingredients.findOneByOrFail({ name: 'Pechuga de pollo' })).id;
    huevoId = (await ingredients.findOneByOrFail({ name: 'Huevo' })).id;
    arrozId = (await ingredients.findOneByOrFail({ name: 'Arroz blanco' })).id;
  });

  afterAll(async () => {
    await app.close();
  });

  // 200 g de pollo + 2 huevos (100 g), 2 porciones
  const newRecipe = () => ({
    name: 'Pollo con huevo',
    description: 'Prueba',
    prepTimeMinutes: 15,
    servingSize: 2,
    categoryId: desayunoId,
    ingredients: [
      { ingredientId: polloId, quantity: 200, unit: Unit.GRAMS },
      { ingredientId: huevoId, quantity: 2, unit: Unit.UNIT },
    ],
  });

  describe('Acceso', () => {
    it.each([
      ['get', '/recipes'],
      ['get', `/recipes/${MISSING_ID}`],
      ['post', '/recipes'],
      ['patch', `/recipes/${MISSING_ID}`],
      ['delete', `/recipes/${MISSING_ID}`],
    ] as const)('%s %s responde 401 sin token', async (method, path) => {
      await http()[method](path).expect(401);
    });

    it.each([
      ['post', '/recipes'],
      ['patch', `/recipes/${MISSING_ID}`],
      ['delete', `/recipes/${MISSING_ID}`],
    ] as const)('%s %s responde 403 para un USER', async (method, path) => {
      await http()[method](path).set(auth(userToken)).send(newRecipe()).expect(403);
    });
  });

  describe('GET /recipes', () => {
    it('un USER ve todas las recetas con su categoría, ordenadas por nombre', async () => {
      const res = await http().get('/recipes').set(auth(userToken)).expect(200);

      expect(res.body).toHaveLength(RECIPES.length);
      const ordered = await dataSource.getRepository(Recipe).find({ order: { name: 'ASC' } });
      expect(res.body.map((r: RecipeBody) => r.name)).toEqual(ordered.map((r) => r.name));
      expect(res.body[0].category).toEqual({ id: expect.any(String), name: expect.any(String) });
      expect(typeof res.body[0].calories).toBe('number');
    });

    it('filtra por categoría', async () => {
      const res = await http().get(`/recipes?categoryId=${desayunoId}`).set(auth(userToken)).expect(200);

      expect(res.body).toHaveLength(RECIPES.filter((r) => r.category === 'Desayuno').length);
      expect(res.body.every((r: RecipeBody) => r.category.name === 'Desayuno')).toBe(true);
    });

    it('filtra por nombre, tiempo, calorías y proteína (combinados)', async () => {
      const bySearch = await http().get('/recipes?search=POLLO').set(auth(userToken)).expect(200);
      expect(bySearch.body.length).toBeGreaterThan(0);
      expect(bySearch.body.every((r: RecipeBody) => /pollo/i.test(r.name))).toBe(true);

      const res = await http()
        .get('/recipes?maxPrepTime=20&maxCalories=600&minProtein=20')
        .set(auth(userToken))
        .expect(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.length).toBeLessThan(RECIPES.length);
      for (const recipe of res.body as RecipeBody[]) {
        expect(recipe.prepTimeMinutes).toBeLessThanOrEqual(20);
        expect(recipe.calories).toBeLessThanOrEqual(600);
        expect(recipe.protein).toBeGreaterThanOrEqual(20);
      }
    });

    it('sin coincidencias devuelve una lista vacía', async () => {
      const res = await http().get('/recipes?search=zzz-no-existe').set(auth(userToken)).expect(200);

      expect(res.body).toEqual([]);
    });

    it.each([
      ['categoryId que no es UUID', 'categoryId=abc'],
      ['maxPrepTime que no es número', 'maxPrepTime=mucho'],
      ['maxPrepTime con decimales', 'maxPrepTime=10.5'],
      ['minProtein negativo', 'minProtein=-1'],
      ['un filtro que no existe', 'color=rojo'],
    ])('responde 400 con %s', async (_caso, query) => {
      await http().get(`/recipes?${query}`).set(auth(userToken)).expect(400);
    });
  });

  describe('GET /recipes/:id', () => {
    it('devuelve la receta con sus ingredientes', async () => {
      const recipe = await dataSource.getRepository(Recipe).findOneByOrFail({ name: 'Pollo con arroz y brócoli' });

      const res = await http().get(`/recipes/${recipe.id}`).set(auth(userToken)).expect(200);

      expect(res.body).toMatchObject({ id: recipe.id, name: 'Pollo con arroz y brócoli', servingSize: 2 });
      expect(res.body.ingredients).toHaveLength(5);
      expect(res.body.ingredients).toContainEqual({
        ingredientId: polloId,
        name: 'Pechuga de pollo',
        quantity: 400,
        unit: Unit.GRAMS,
      });
    });

    it('responde 404 si no existe y 400 si el id no es un UUID', async () => {
      await http().get(`/recipes/${MISSING_ID}`).set(auth(userToken)).expect(404);
      await http().get('/recipes/abc').set(auth(userToken)).expect(400);
    });
  });

  describe('POST /recipes', () => {
    let createdId: string;

    it('crea la receta y calcula los macros por porción', async () => {
      const res = await http().post('/recipes').set(auth(adminToken)).send(newRecipe()).expect(201);

      // (330 + 143) kcal / 2, (62 + 12.6) g / 2, (0 + 0.7) / 2, (7.2 + 9.5) / 2
      expect(res.body).toMatchObject({
        name: 'Pollo con huevo',
        description: 'Prueba',
        servingSize: 2,
        calories: 236.5,
        protein: 37.3,
        carbs: 0.35,
        fat: 8.35,
        category: { id: desayunoId, name: 'Desayuno' },
      });
      expect(res.body.ingredients).toHaveLength(2);
      createdId = res.body.id;
      expect(await dataSource.getRepository(RecipeIngredient).countBy({ recipeId: createdId })).toBe(2);
    });

    it('responde 409 si el nombre ya existe, sin importar mayúsculas', async () => {
      const res = await http()
        .post('/recipes')
        .set(auth(adminToken))
        .send({ ...newRecipe(), name: 'POLLO CON HUEVO' })
        .expect(409);

      expect(res.body.message).toBe('Ya existe una receta con ese nombre');
    });

    it.each([
      ['macros enviados por el cliente', { calories: 100 }],
      ['sin ingredientes', { ingredients: [] }],
      ['ingrediente repetido', {
        ingredients: [
          { ingredientId: '11111111-1111-4111-8111-111111111111', quantity: 1, unit: Unit.GRAMS },
          { ingredientId: '11111111-1111-4111-8111-111111111111', quantity: 2, unit: Unit.GRAMS },
        ],
      }],
      ['unidad inválida', { ingredients: [{ ingredientId: MISSING_ID, quantity: 1, unit: 'taza' }] }],
      ['cantidad en 0', { ingredients: [{ ingredientId: MISSING_ID, quantity: 0, unit: Unit.GRAMS }] }],
      ['ingredientId que no es UUID', { ingredients: [{ ingredientId: 'x', quantity: 1, unit: Unit.GRAMS }] }],
      ['tiempo en 0', { prepTimeMinutes: 0 }],
      ['más de 50 porciones', { servingSize: 51 }],
      ['categoryId que no es UUID', { categoryId: 'desayuno' }],
      ['nombre vacío', { name: '  ' }],
    ])('responde 400 con %s', async (_caso, changes) => {
      await http()
        .post('/recipes')
        .set(auth(adminToken))
        .send({ ...newRecipe(), name: `Otra ${_caso}`, ...changes })
        .expect(400);
    });

    it("responde 400 si usa 'unidad' con un ingrediente sin gramsPerUnit", async () => {
      const res = await http()
        .post('/recipes')
        .set(auth(adminToken))
        .send({
          ...newRecipe(),
          name: 'Pollo por unidad',
          ingredients: [{ ingredientId: polloId, quantity: 1, unit: Unit.UNIT }],
        })
        .expect(400);

      expect(res.body.message).toContain('Pechuga de pollo');
    });

    it('responde 404 si la categoría no existe', async () => {
      await http()
        .post('/recipes')
        .set(auth(adminToken))
        .send({ ...newRecipe(), name: 'Sin categoría', categoryId: MISSING_ID })
        .expect(404);
    });

    it('responde 404 diciendo qué ingrediente no existe', async () => {
      const res = await http()
        .post('/recipes')
        .set(auth(adminToken))
        .send({
          ...newRecipe(),
          name: 'Con fantasma',
          ingredients: [
            { ingredientId: polloId, quantity: 100, unit: Unit.GRAMS },
            { ingredientId: MISSING_ID, quantity: 100, unit: Unit.GRAMS },
          ],
        })
        .expect(404);

      expect(res.body.message).toContain(MISSING_ID);
      expect(await dataSource.getRepository(Recipe).existsBy({ name: 'Con fantasma' })).toBe(false);
    });

    describe('PATCH /recipes/:id', () => {
      it('al cambiar las porciones recalcula los macros', async () => {
        const res = await http()
          .patch(`/recipes/${createdId}`)
          .set(auth(adminToken))
          .send({ servingSize: 1 })
          .expect(200);

        expect(res.body).toMatchObject({ servingSize: 1, calories: 473, protein: 74.6 });
      });

      it('al enviar ingredientes reemplaza todas las líneas y recalcula', async () => {
        const res = await http()
          .patch(`/recipes/${createdId}`)
          .set(auth(adminToken))
          .send({ ingredients: [{ ingredientId: arrozId, quantity: 100, unit: Unit.GRAMS }] })
          .expect(200);

        expect(res.body.ingredients).toEqual([
          { ingredientId: arrozId, name: 'Arroz blanco', quantity: 100, unit: Unit.GRAMS },
        ]);
        expect(res.body).toMatchObject({ calories: 365, protein: 7.1, carbs: 80, fat: 0.7 });
        expect(await dataSource.getRepository(RecipeIngredient).countBy({ recipeId: createdId })).toBe(1);
      });

      it('cambia campos simples sin tocar los macros y permite borrar la descripción', async () => {
        const res = await http()
          .patch(`/recipes/${createdId}`)
          .set(auth(adminToken))
          .send({ name: 'Arroz solo', prepTimeMinutes: 25, description: null })
          .expect(200);

        expect(res.body).toMatchObject({ name: 'Arroz solo', prepTimeMinutes: 25, description: null, calories: 365 });
      });

      it.each([
        ['nombre null', { name: null }],
        ['porciones null', { servingSize: null }],
        ['macros enviados', { protein: 10 }],
        ['lista de ingredientes vacía', { ingredients: [] }],
      ])('responde 400 con %s', async (_caso, body) => {
        await http().patch(`/recipes/${createdId}`).set(auth(adminToken)).send(body).expect(400);
      });

      it('responde 409 si el nombre es de otra receta y 404 si no existe', async () => {
        await http()
          .patch(`/recipes/${createdId}`)
          .set(auth(adminToken))
          .send({ name: 'pollo con arroz y brócoli' })
          .expect(409);
        await http().patch(`/recipes/${MISSING_ID}`).set(auth(adminToken)).send({ name: 'X y Z' }).expect(404);
      });

      it('responde 404 si la nueva categoría no existe', async () => {
        await http()
          .patch(`/recipes/${createdId}`)
          .set(auth(adminToken))
          .send({ categoryId: MISSING_ID })
          .expect(404);
      });
    });

    describe('DELETE /recipes/:id', () => {
      it('elimina la receta y sus líneas (204); después responde 404', async () => {
        await http().delete(`/recipes/${createdId}`).set(auth(adminToken)).expect(204);

        expect(await dataSource.getRepository(Recipe).existsBy({ id: createdId })).toBe(false);
        expect(await dataSource.getRepository(RecipeIngredient).countBy({ recipeId: createdId })).toBe(0);
        await http().delete(`/recipes/${createdId}`).set(auth(adminToken)).expect(404);
      });

      it('responde 409 si la receta está en un plan semanal', async () => {
        await http()
          .patch('/users/me/macros')
          .set(auth(userToken))
          .send({ dailyCalories: 2000, dailyProtein: 150, dailyCarbs: 200, dailyFat: 67 })
          .expect(200);
        await http().post('/meal-plan/generate').set(auth(userToken)).expect(201);
        const [entry] = await dataSource.getRepository(MealPlanEntry).find({ take: 1 });

        const res = await http().delete(`/recipes/${entry.recipeId}`).set(auth(adminToken)).expect(409);

        expect(res.body.message).toContain('plan');
        expect(await dataSource.getRepository(Recipe).existsBy({ id: entry.recipeId })).toBe(true);
      });
    });
  });
});
