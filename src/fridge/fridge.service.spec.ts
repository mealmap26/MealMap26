import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { Ingredient } from '../ingredients/entities/ingredient.entity.js';
import { RecipeIngredient } from '../recipes/entities/recipe-ingredient.entity.js';
import { UserIngredient } from './entities/user-ingredient.entity.js';
import { FridgeService } from './fridge.service.js';

describe('FridgeService', () => {
  let service: FridgeService;

  const fridge = {
    find: vi.fn(),
    findBy: vi.fn(),
    findOneBy: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  };
  const ingredients = { findOneBy: vi.fn() };
  const recipeIngredients = { find: vi.fn() };

  const arroz = { id: 'ing-arroz', name: 'Arroz blanco' };

  beforeEach(async () => {
    vi.resetAllMocks();
    fridge.create.mockImplementation((data: object) => data);

    const moduleRef = await Test.createTestingModule({
      providers: [
        FridgeService,
        { provide: getRepositoryToken(UserIngredient), useValue: fridge },
        { provide: getRepositoryToken(Ingredient), useValue: ingredients },
        {
          provide: getRepositoryToken(RecipeIngredient),
          useValue: recipeIngredients,
        },
      ],
    }).compile();

    service = moduleRef.get(FridgeService);
  });

  it('list devuelve los ingredientes del usuario con su nombre', async () => {
    fridge.find.mockResolvedValue([
      { ingredientId: 'ing-arroz', ingredient: arroz },
    ]);

    await expect(service.list('user-1')).resolves.toEqual([
      { ingredientId: 'ing-arroz', name: 'Arroz blanco' },
    ]);
    expect(fridge.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
  });

  describe('add', () => {
    it('agrega el ingrediente y lo devuelve', async () => {
      ingredients.findOneBy.mockResolvedValue(arroz);

      await expect(service.add('user-1', 'ing-arroz')).resolves.toEqual({
        ingredientId: 'ing-arroz',
        name: 'Arroz blanco',
      });
      expect(fridge.save).toHaveBeenCalledWith({
        userId: 'user-1',
        ingredientId: 'ing-arroz',
      });
    });

    it('lanza NotFound si el ingrediente no existe', async () => {
      ingredients.findOneBy.mockResolvedValue(null);

      await expect(service.add('user-1', 'ing-x')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza Conflict si ya está en la nevera (la base rechaza el duplicado)', async () => {
      ingredients.findOneBy.mockResolvedValue(arroz);
      fridge.save.mockRejectedValue(
        new QueryFailedError(
          'INSERT',
          [],
          Object.assign(new Error('dup'), { code: '23505' }),
        ),
      );

      await expect(service.add('user-1', 'ing-arroz')).rejects.toThrow(
        new ConflictException('El ingrediente ya está en tu nevera'),
      );
    });

    it('propaga otros errores de la base', async () => {
      ingredients.findOneBy.mockResolvedValue(arroz);
      fridge.save.mockRejectedValue(new Error('se cayó la base'));

      await expect(service.add('user-1', 'ing-arroz')).rejects.toThrow(
        'se cayó la base',
      );
    });
  });

  describe('remove', () => {
    it('quita el ingrediente de la nevera', async () => {
      const item = { id: 'ui-1', userId: 'user-1', ingredientId: 'ing-arroz' };
      fridge.findOneBy.mockResolvedValue(item);

      await service.remove('user-1', 'ing-arroz');

      expect(fridge.findOneBy).toHaveBeenCalledWith({
        userId: 'user-1',
        ingredientId: 'ing-arroz',
      });
      expect(fridge.remove).toHaveBeenCalledWith(item);
    });

    it('lanza NotFound si no está en la nevera', async () => {
      fridge.findOneBy.mockResolvedValue(null);

      await expect(service.remove('user-1', 'ing-arroz')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('suggestions', () => {
    it('con la nevera vacía devuelve una lista vacía sin consultar el catálogo', async () => {
      fridge.findBy.mockResolvedValue([]);

      await expect(service.suggestions('user-1')).resolves.toEqual([]);
      expect(recipeIngredients.find).not.toHaveBeenCalled();
    });

    it('arma el catálogo con los ingredientes de cada receta y aplica maxMissing', async () => {
      fridge.findBy.mockResolvedValue([{ ingredientId: 'ing-arroz' }]);
      const category = { id: 'cat-1', name: 'Rápido' };
      const macros = {
        prepTimeMinutes: 5,
        calories: 1,
        protein: 1,
        carbs: 1,
        fat: 1,
        category,
      };
      const r1 = { id: 'r1', name: 'Arroz solo', ...macros };
      const r2 = { id: 'r2', name: 'Arroz con huevo', ...macros };
      recipeIngredients.find.mockResolvedValue([
        {
          recipeId: 'r1',
          recipe: r1,
          ingredientId: 'ing-arroz',
          ingredient: arroz,
        },
        {
          recipeId: 'r2',
          recipe: r2,
          ingredientId: 'ing-arroz',
          ingredient: arroz,
        },
        {
          recipeId: 'r2',
          recipe: r2,
          ingredientId: 'ing-huevo',
          ingredient: { name: 'Huevo' },
        },
      ]);

      const exact = await service.suggestions('user-1');
      expect(exact.map((s) => s.recipe.id)).toEqual(['r1']);

      const near = await service.suggestions('user-1', 1);
      expect(near.map((s) => s.recipe.id)).toEqual(['r1', 'r2']);
      expect(near[1].missingIngredients).toEqual([
        { id: 'ing-huevo', name: 'Huevo' },
      ]);
      expect(near[1].recipe.category).toEqual(category);
    });

    it('solo consulta las recetas que comparten algún ingrediente con la nevera del usuario', async () => {
      fridge.findBy.mockResolvedValue([{ ingredientId: 'ing-arroz' }]);
      recipeIngredients.find.mockResolvedValue([]);

      await expect(service.suggestions('user-1', 5)).resolves.toEqual([]);

      const { where, relations } = recipeIngredients.find.mock.calls[0][0];
      expect(where.recipeId.getSql('"recipeId"')).toMatch(/"user_ingredients"/);
      expect(where.recipeId.objectLiteralParameters).toEqual({
        userId: 'user-1',
      });
      expect(relations).toEqual({
        recipe: { category: true },
        ingredient: true,
      });
    });
  });
});
