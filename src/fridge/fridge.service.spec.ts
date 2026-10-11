import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { Ingredient } from '../ingredients/entities/ingredient.entity.js';
import { RecipeIngredient } from '../recipes/entities/recipe-ingredient.entity.js';
import { Recipe } from '../recipes/entities/recipe.entity.js';
import { UserIngredient } from './entities/user-ingredient.entity.js';
import { FridgeService } from './fridge.service.js';

describe('FridgeService', () => {
  let service: FridgeService;

  const fridge = {
    find: vi.fn(),
    findBy: vi.fn(),
    findOneBy: vi.fn(),
    existsBy: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  };
  const ingredients = { findOneBy: vi.fn() };
  const recipes = { find: vi.fn() };
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
        { provide: getRepositoryToken(Recipe), useValue: recipes },
        { provide: getRepositoryToken(RecipeIngredient), useValue: recipeIngredients },
      ],
    }).compile();

    service = moduleRef.get(FridgeService);
  });

  it('list devuelve los ingredientes del usuario con su nombre', async () => {
    fridge.find.mockResolvedValue([{ ingredientId: 'ing-arroz', ingredient: arroz }]);

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
      fridge.existsBy.mockResolvedValue(false);

      await expect(service.add('user-1', 'ing-arroz')).resolves.toEqual({
        ingredientId: 'ing-arroz',
        name: 'Arroz blanco',
      });
      expect(fridge.save).toHaveBeenCalledWith({ userId: 'user-1', ingredientId: 'ing-arroz' });
    });

    it('lanza NotFound si el ingrediente no existe', async () => {
      ingredients.findOneBy.mockResolvedValue(null);

      await expect(service.add('user-1', 'ing-x')).rejects.toThrow(NotFoundException);
    });

    it('lanza Conflict si ya está en la nevera', async () => {
      ingredients.findOneBy.mockResolvedValue(arroz);
      fridge.existsBy.mockResolvedValue(true);

      await expect(service.add('user-1', 'ing-arroz')).rejects.toThrow(ConflictException);
      expect(fridge.save).not.toHaveBeenCalled();
    });

    it('lanza Conflict si la base rechaza el duplicado (peticiones simultáneas)', async () => {
      ingredients.findOneBy.mockResolvedValue(arroz);
      fridge.existsBy.mockResolvedValue(false);
      fridge.save.mockRejectedValue(
        new QueryFailedError('INSERT', [], Object.assign(new Error('dup'), { code: '23505' })),
      );

      await expect(service.add('user-1', 'ing-arroz')).rejects.toThrow(ConflictException);
    });

    it('propaga otros errores de la base', async () => {
      ingredients.findOneBy.mockResolvedValue(arroz);
      fridge.existsBy.mockResolvedValue(false);
      fridge.save.mockRejectedValue(new Error('se cayó la base'));

      await expect(service.add('user-1', 'ing-arroz')).rejects.toThrow('se cayó la base');
    });
  });

  describe('remove', () => {
    it('quita el ingrediente de la nevera', async () => {
      const item = { id: 'ui-1', userId: 'user-1', ingredientId: 'ing-arroz' };
      fridge.findOneBy.mockResolvedValue(item);

      await service.remove('user-1', 'ing-arroz');

      expect(fridge.findOneBy).toHaveBeenCalledWith({ userId: 'user-1', ingredientId: 'ing-arroz' });
      expect(fridge.remove).toHaveBeenCalledWith(item);
    });

    it('lanza NotFound si no está en la nevera', async () => {
      fridge.findOneBy.mockResolvedValue(null);

      await expect(service.remove('user-1', 'ing-arroz')).rejects.toThrow(NotFoundException);
    });
  });

  describe('suggestions', () => {
    it('con la nevera vacía devuelve una lista vacía sin consultar el catálogo', async () => {
      fridge.findBy.mockResolvedValue([]);

      await expect(service.suggestions('user-1')).resolves.toEqual([]);
      expect(recipes.find).not.toHaveBeenCalled();
    });

    it('arma el catálogo con los ingredientes de cada receta y aplica maxMissing', async () => {
      fridge.findBy.mockResolvedValue([{ ingredientId: 'ing-arroz' }]);
      const category = { id: 'cat-1', name: 'Rápido' };
      recipes.find.mockResolvedValue([
        { id: 'r1', name: 'Arroz solo', prepTimeMinutes: 5, calories: 1, protein: 1, carbs: 1, fat: 1, category },
        { id: 'r2', name: 'Arroz con huevo', prepTimeMinutes: 5, calories: 1, protein: 1, carbs: 1, fat: 1, category },
      ]);
      recipeIngredients.find.mockResolvedValue([
        { recipeId: 'r1', ingredientId: 'ing-arroz', ingredient: arroz },
        { recipeId: 'r2', ingredientId: 'ing-arroz', ingredient: arroz },
        { recipeId: 'r2', ingredientId: 'ing-huevo', ingredient: { name: 'Huevo' } },
      ]);

      const exact = await service.suggestions('user-1');
      expect(exact.map((s) => s.recipe.id)).toEqual(['r1']);

      const near = await service.suggestions('user-1', 1);
      expect(near.map((s) => s.recipe.id)).toEqual(['r1', 'r2']);
      expect(near[1].missingIngredients).toEqual([{ id: 'ing-huevo', name: 'Huevo' }]);
      expect(near[1].recipe.category).toEqual(category);
    });
  });
});
