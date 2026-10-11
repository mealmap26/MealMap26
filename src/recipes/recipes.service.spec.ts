import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { Category } from '../categories/entities/category.entity.js';
import { Ingredient } from '../ingredients/entities/ingredient.entity.js';
import { MealPlanEntry } from '../meal-plan/entities/meal-plan-entry.entity.js';
import { RecipeIngredient } from './entities/recipe-ingredient.entity.js';
import { Recipe } from './entities/recipe.entity.js';
import { Unit } from './enums/unit.enum.js';
import { RecipesService } from './recipes.service.js';

describe('RecipesService', () => {
  let service: RecipesService;

  const manager = {
    create: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  };
  const recipes = {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneBy: vi.fn(),
    remove: vi.fn(),
    manager: { transaction: vi.fn() },
  };
  const recipeIngredients = { find: vi.fn() };
  const categories = { existsBy: vi.fn() };
  const ingredients = { findBy: vi.fn() };
  const mealPlanEntries = { existsBy: vi.fn() };

  const category = { id: 'cat-1', name: 'Desayuno' };
  const pollo = {
    id: 'ing-pollo',
    name: 'Pechuga de pollo',
    caloriesPer100g: 165,
    proteinPer100g: 31,
    carbsPer100g: 0,
    fatPer100g: 3.6,
    gramsPerUnit: null,
  } as Ingredient;
  const huevo = {
    id: 'ing-huevo',
    name: 'Huevo',
    caloriesPer100g: 143,
    proteinPer100g: 12.6,
    carbsPer100g: 0.7,
    fatPer100g: 9.5,
    gramsPerUnit: 50,
  } as Ingredient;

  const storedRecipe = (overrides: Partial<Recipe> = {}): Recipe =>
    ({
      id: 'rec-1',
      name: 'Pollo simple',
      description: null,
      prepTimeMinutes: 20,
      servingSize: 2,
      calories: 165,
      protein: 31,
      carbs: 0,
      fat: 3.6,
      categoryId: 'cat-1',
      category,
      ...overrides,
    }) as Recipe;

  const createDto = () => ({
    name: 'Pollo simple',
    prepTimeMinutes: 20,
    servingSize: 2,
    categoryId: 'cat-1',
    ingredients: [
      { ingredientId: 'ing-pollo', quantity: 200, unit: Unit.GRAMS },
    ],
  });

  beforeEach(async () => {
    vi.resetAllMocks();
    recipes.manager.transaction.mockImplementation(
      (callback: (m: typeof manager) => Promise<unknown>) => callback(manager),
    );
    manager.create.mockImplementation((_entity: unknown, data: object) => data);
    manager.save.mockImplementation((data: object | object[]) =>
      Array.isArray(data) ? data : { ...data, id: 'rec-1' },
    );
    // findOne del detalle que se devuelve al final
    recipes.findOne.mockResolvedValue(storedRecipe());
    recipeIngredients.find.mockResolvedValue([]);
    categories.existsBy.mockResolvedValue(true);

    const moduleRef = await Test.createTestingModule({
      providers: [
        RecipesService,
        { provide: getRepositoryToken(Recipe), useValue: recipes },
        {
          provide: getRepositoryToken(RecipeIngredient),
          useValue: recipeIngredients,
        },
        { provide: getRepositoryToken(Category), useValue: categories },
        { provide: getRepositoryToken(Ingredient), useValue: ingredients },
        {
          provide: getRepositoryToken(MealPlanEntry),
          useValue: mealPlanEntries,
        },
      ],
    }).compile();

    service = moduleRef.get(RecipesService);
  });

  describe('findAll', () => {
    it('sin filtros lista todas con su categoría, ordenadas por nombre', async () => {
      recipes.find.mockResolvedValue([storedRecipe()]);

      const result = await service.findAll({});

      expect(recipes.find).toHaveBeenCalledWith({
        where: {},
        relations: { category: true },
        order: { name: 'ASC' },
      });
      expect(result).toEqual([
        expect.objectContaining({
          id: 'rec-1',
          category: { id: 'cat-1', name: 'Desayuno' },
        }),
      ]);
    });

    it('arma un filtro por cada parámetro enviado', async () => {
      recipes.find.mockResolvedValue([]);

      await service.findAll({
        categoryId: 'cat-1',
        search: 'pollo',
        maxPrepTime: 15,
        maxCalories: 500,
        minProtein: 30,
      });

      const { where } = recipes.find.mock.calls[0][0];
      expect(where.categoryId).toBe('cat-1');
      expect(where.name.value).toBe('%pollo%');
      expect(where.prepTimeMinutes).toMatchObject({
        type: 'lessThanOrEqual',
        value: 15,
      });
      expect(where.calories).toMatchObject({
        type: 'lessThanOrEqual',
        value: 500,
      });
      expect(where.protein).toMatchObject({
        type: 'moreThanOrEqual',
        value: 30,
      });
    });
  });

  describe('findOne', () => {
    it('devuelve la receta con sus líneas de ingredientes', async () => {
      recipeIngredients.find.mockResolvedValue([
        {
          ingredientId: 'ing-pollo',
          ingredient: pollo,
          quantity: 200,
          unit: Unit.GRAMS,
        },
      ]);

      const detail = await service.findOne('rec-1');

      expect(detail.ingredients).toEqual([
        {
          ingredientId: 'ing-pollo',
          name: 'Pechuga de pollo',
          quantity: 200,
          unit: Unit.GRAMS,
        },
      ]);
    });

    it('lanza NotFound si no existe', async () => {
      recipes.findOne.mockResolvedValue(null);

      await expect(service.findOne('rec-x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('calcula los macros por porción y guarda receta y líneas en una transacción', async () => {
      recipes.findOneBy.mockResolvedValue(null);
      ingredients.findBy.mockResolvedValue([pollo]);

      await service.create(createDto());

      // 200 g de pollo entre 2 porciones
      expect(manager.create).toHaveBeenCalledWith(Recipe, {
        name: 'Pollo simple',
        description: null,
        prepTimeMinutes: 20,
        servingSize: 2,
        categoryId: 'cat-1',
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
      });
      expect(manager.save).toHaveBeenLastCalledWith([
        {
          recipeId: 'rec-1',
          ingredientId: 'ing-pollo',
          quantity: 200,
          unit: Unit.GRAMS,
        },
      ]);
    });

    it('lanza Conflict si ya existe una receta con ese nombre', async () => {
      recipes.findOneBy.mockResolvedValue(storedRecipe({ id: 'otra' }));

      await expect(service.create(createDto())).rejects.toThrow(
        ConflictException,
      );
      expect(recipes.manager.transaction).not.toHaveBeenCalled();
    });

    it('lanza Conflict si la base rechaza el nombre repetido (peticiones simultáneas)', async () => {
      recipes.findOneBy.mockResolvedValue(null);
      ingredients.findBy.mockResolvedValue([pollo]);
      manager.save.mockRejectedValueOnce(
        new QueryFailedError(
          'INSERT',
          [],
          Object.assign(new Error('dup'), { code: '23505' }),
        ),
      );

      await expect(service.create(createDto())).rejects.toThrow(
        new ConflictException('Ya existe una receta con ese nombre'),
      );
    });

    it('lanza NotFound si la categoría no existe', async () => {
      recipes.findOneBy.mockResolvedValue(null);
      categories.existsBy.mockResolvedValue(false);

      await expect(service.create(createDto())).rejects.toThrow(
        /categoría cat-1/,
      );
    });

    it('lanza NotFound diciendo qué ingredientes no existen', async () => {
      recipes.findOneBy.mockResolvedValue(null);
      ingredients.findBy.mockResolvedValue([]);

      await expect(service.create(createDto())).rejects.toThrow(
        new NotFoundException('No existen los ingredientes: ing-pollo'),
      );
    });

    it("lanza BadRequest si se usa 'unidad' con un ingrediente sin gramsPerUnit", async () => {
      recipes.findOneBy.mockResolvedValue(null);
      ingredients.findBy.mockResolvedValue([pollo]);
      const dto = createDto();
      dto.ingredients[0].unit = Unit.UNIT;

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      expect(recipes.manager.transaction).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('lanza NotFound si la receta no existe', async () => {
      recipes.findOneBy.mockResolvedValue(null);

      await expect(service.update('rec-x', { name: 'Otra' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('si solo cambian campos simples no recalcula ni toca las líneas', async () => {
      recipes.findOneBy
        .mockResolvedValueOnce(storedRecipe()) // la receta
        .mockResolvedValueOnce(null); // el nombre está libre

      await service.update('rec-1', {
        name: 'Pollo distinto',
        prepTimeMinutes: 25,
      });

      expect(manager.delete).not.toHaveBeenCalled();
      expect(manager.update).toHaveBeenCalledWith(
        Recipe,
        { id: 'rec-1' },
        { name: 'Pollo distinto', prepTimeMinutes: 25 },
      );
    });

    it('con un body vacío no actualiza nada', async () => {
      recipes.findOneBy.mockResolvedValueOnce(storedRecipe());

      await service.update('rec-1', {});

      expect(manager.update).not.toHaveBeenCalled();
    });

    it('al cambiar las porciones recalcula con las líneas actuales', async () => {
      recipes.findOneBy.mockResolvedValueOnce(storedRecipe());
      recipeIngredients.find.mockResolvedValueOnce([
        { quantity: 200, unit: Unit.GRAMS, ingredient: pollo },
      ]);

      await service.update('rec-1', { servingSize: 1 });

      expect(manager.update).toHaveBeenCalledWith(
        Recipe,
        { id: 'rec-1' },
        { servingSize: 1, calories: 330, protein: 62, carbs: 0, fat: 7.2 },
      );
    });

    it('al enviar ingredientes reemplaza las líneas y recalcula', async () => {
      recipes.findOneBy.mockResolvedValueOnce(storedRecipe());
      ingredients.findBy.mockResolvedValue([huevo]);

      await service.update('rec-1', {
        ingredients: [
          { ingredientId: 'ing-huevo', quantity: 4, unit: Unit.UNIT },
        ],
      });

      expect(manager.delete).toHaveBeenCalledWith(RecipeIngredient, {
        recipeId: 'rec-1',
      });
      expect(manager.save).toHaveBeenCalledWith([
        {
          recipeId: 'rec-1',
          ingredientId: 'ing-huevo',
          quantity: 4,
          unit: Unit.UNIT,
        },
      ]);
      // 4 huevos x 50 g = 200 g, entre 2 porciones
      expect(manager.update).toHaveBeenCalledWith(
        Recipe,
        { id: 'rec-1' },
        { calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5 },
      );
    });

    it('lanza NotFound si la nueva categoría no existe', async () => {
      recipes.findOneBy.mockResolvedValueOnce(storedRecipe());
      categories.existsBy.mockResolvedValue(false);

      await expect(
        service.update('rec-1', { categoryId: 'cat-x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza Conflict si el nombre es de otra receta', async () => {
      recipes.findOneBy
        .mockResolvedValueOnce(storedRecipe())
        .mockResolvedValueOnce(storedRecipe({ id: 'rec-2' }));

      await expect(service.update('rec-1', { name: 'Ajeno' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('lanza Conflict si la base rechaza el nombre repetido (peticiones simultáneas)', async () => {
      recipes.findOneBy
        .mockResolvedValueOnce(storedRecipe())
        .mockResolvedValueOnce(null);
      manager.update.mockRejectedValueOnce(
        new QueryFailedError(
          'UPDATE',
          [],
          Object.assign(new Error('dup'), { code: '23505' }),
        ),
      );

      await expect(service.update('rec-1', { name: 'Ajeno' })).rejects.toThrow(
        new ConflictException('Ya existe una receta con ese nombre'),
      );
    });
  });

  describe('remove', () => {
    it('elimina la receta que no está en ningún plan', async () => {
      const recipe = storedRecipe();
      recipes.findOneBy.mockResolvedValue(recipe);
      mealPlanEntries.existsBy.mockResolvedValue(false);

      await service.remove('rec-1');

      expect(recipes.remove).toHaveBeenCalledWith(recipe);
    });

    it('lanza NotFound si no existe', async () => {
      recipes.findOneBy.mockResolvedValue(null);

      await expect(service.remove('rec-x')).rejects.toThrow(NotFoundException);
    });

    it('lanza Conflict si está en un plan', async () => {
      recipes.findOneBy.mockResolvedValue(storedRecipe());
      mealPlanEntries.existsBy.mockResolvedValue(true);

      await expect(service.remove('rec-1')).rejects.toThrow(ConflictException);
      expect(recipes.remove).not.toHaveBeenCalled();
    });

    it('si la base rechaza el borrado por llave foránea responde Conflict', async () => {
      recipes.findOneBy.mockResolvedValue(storedRecipe());
      mealPlanEntries.existsBy.mockResolvedValue(false);
      recipes.remove.mockRejectedValue(
        new QueryFailedError(
          'DELETE',
          [],
          Object.assign(new Error('fk'), { code: '23503' }),
        ),
      );

      await expect(service.remove('rec-1')).rejects.toThrow(ConflictException);
    });

    it('propaga otros errores de la base', async () => {
      recipes.findOneBy.mockResolvedValue(storedRecipe());
      mealPlanEntries.existsBy.mockResolvedValue(false);
      recipes.remove.mockRejectedValue(new Error('se cayó la base'));

      await expect(service.remove('rec-1')).rejects.toThrow('se cayó la base');
    });
  });
});
