import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RecipeIngredient } from '../recipes/entities/recipe-ingredient.entity.js';
import { Recipe } from '../recipes/entities/recipe.entity.js';
import { Unit } from '../recipes/enums/unit.enum.js';
import { Ingredient } from './entities/ingredient.entity.js';
import { IngredientsService } from './ingredients.service.js';

describe('IngredientsService', () => {
  let service: IngredientsService;

  const manager = {
    save: vi.fn(),
    find: vi.fn(),
    update: vi.fn(),
  };
  const ingredients = {
    find: vi.fn(),
    findOneBy: vi.fn(),
    create: vi.fn(),
    merge: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    manager: { transaction: vi.fn() },
  };
  const recipeIngredients = { existsBy: vi.fn() };

  const buildIngredient = (overrides: Partial<Ingredient> = {}): Ingredient => ({
    id: 'ing-1',
    name: 'Huevo',
    caloriesPer100g: 143,
    proteinPer100g: 12.6,
    carbsPer100g: 0.7,
    fatPer100g: 9.5,
    gramsPerUnit: 50,
    ...overrides,
  });

  beforeEach(async () => {
    vi.resetAllMocks();
    ingredients.create.mockImplementation((data: object) => data);
    ingredients.save.mockImplementation((data: object) => ({ id: 'ing-new', ...data }));
    ingredients.merge.mockImplementation((target: object, data: object) =>
      Object.assign(target, data),
    );
    ingredients.manager.transaction.mockImplementation(
      (callback: (m: typeof manager) => Promise<unknown>) => callback(manager),
    );
    manager.save.mockImplementation((data: object) => data);

    const moduleRef = await Test.createTestingModule({
      providers: [
        IngredientsService,
        { provide: getRepositoryToken(Ingredient), useValue: ingredients },
        { provide: getRepositoryToken(RecipeIngredient), useValue: recipeIngredients },
      ],
    }).compile();

    service = moduleRef.get(IngredientsService);
  });

  describe('findAll', () => {
    it('sin búsqueda lista todos ordenados por nombre', async () => {
      ingredients.find.mockResolvedValue([]);

      await service.findAll();

      expect(ingredients.find).toHaveBeenCalledWith({ where: {}, order: { name: 'ASC' } });
    });

    it('con búsqueda filtra por nombre y escapa los comodines de LIKE', async () => {
      ingredients.find.mockResolvedValue([]);

      await service.findAll('50%_x');

      const { where } = ingredients.find.mock.calls[0][0];
      expect(where.name.value).toBe('%50\\%\\_x%');
    });
  });

  describe('findOne', () => {
    it('lanza NotFound si no existe', async () => {
      ingredients.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('ing-x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('guarda el ingrediente con gramsPerUnit en null si no se envía', async () => {
      ingredients.findOneBy.mockResolvedValue(null);
      const { id: _id, gramsPerUnit: _g, ...dto } = buildIngredient({ name: 'Quinua' });

      const created = await service.create(dto);

      expect(created).toMatchObject({ id: 'ing-new', name: 'Quinua', gramsPerUnit: null });
    });

    it('lanza Conflict si el nombre ya existe', async () => {
      ingredients.findOneBy.mockResolvedValue(buildIngredient());
      const { id: _id, ...dto } = buildIngredient({ name: 'HUEVO' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('si solo cambia el nombre no recalcula recetas', async () => {
      ingredients.findOneBy
        .mockResolvedValueOnce(buildIngredient())
        .mockResolvedValueOnce(null);

      const updated = await service.update('ing-1', { name: 'Huevo de gallina' });

      expect(updated.name).toBe('Huevo de gallina');
      expect(manager.find).not.toHaveBeenCalled();
    });

    it('si el valor enviado es igual al actual no recalcula recetas', async () => {
      ingredients.findOneBy.mockResolvedValueOnce(buildIngredient());

      await service.update('ing-1', { caloriesPer100g: 143 });

      expect(manager.find).not.toHaveBeenCalled();
    });

    it('lanza Conflict si el nombre es de otro ingrediente', async () => {
      ingredients.findOneBy
        .mockResolvedValueOnce(buildIngredient())
        .mockResolvedValueOnce(buildIngredient({ id: 'ing-2', name: 'Leche' }));

      await expect(service.update('ing-1', { name: 'leche' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('si cambian los macros recalcula y guarda los macros de las recetas que lo usan', async () => {
      ingredients.findOneBy.mockResolvedValueOnce(buildIngredient());
      const nuevo = buildIngredient({ caloriesPer100g: 200 });
      manager.find
        .mockResolvedValueOnce([{ recipeId: 'r1' }, { recipeId: 'r1' }]) // usos
        .mockResolvedValueOnce([{ id: 'r1', name: 'Pericos', servingSize: 2 }]) // recetas
        .mockResolvedValueOnce([
          { recipeId: 'r1', quantity: 4, unit: Unit.UNIT, ingredient: nuevo },
        ]); // líneas

      await service.update('ing-1', { caloriesPer100g: 200 });

      // 4 huevos x 50 g = 200 g -> 400 kcal, entre 2 porciones
      expect(manager.update).toHaveBeenCalledWith(
        Recipe,
        { id: 'r1' },
        { calories: 200, protein: 12.6, carbs: 0.7, fat: 9.5 },
      );
    });

    it('si cambian los macros pero ninguna receta lo usa no hace nada más', async () => {
      ingredients.findOneBy.mockResolvedValueOnce(buildIngredient());
      manager.find.mockResolvedValueOnce([]);

      await service.update('ing-1', { fatPer100g: 10 });

      expect(manager.find).toHaveBeenCalledTimes(1);
      expect(manager.update).not.toHaveBeenCalled();
    });

    it("lanza BadRequest si se quita gramsPerUnit y una receta lo usa en 'unidad'", async () => {
      ingredients.findOneBy.mockResolvedValueOnce(buildIngredient());
      const sinPeso = buildIngredient({ gramsPerUnit: null });
      manager.find
        .mockResolvedValueOnce([{ recipeId: 'r1' }])
        .mockResolvedValueOnce([{ id: 'r1', name: 'Pericos', servingSize: 1 }])
        .mockResolvedValueOnce([
          { recipeId: 'r1', quantity: 2, unit: Unit.UNIT, ingredient: sinPeso },
        ]);

      await expect(service.update('ing-1', { gramsPerUnit: null })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('propaga otros errores del recálculo', async () => {
      ingredients.findOneBy.mockResolvedValueOnce(buildIngredient());
      manager.find
        .mockResolvedValueOnce([{ recipeId: 'r1' }])
        .mockResolvedValueOnce([{ id: 'r1', name: 'Pericos', servingSize: 1 }])
        .mockResolvedValueOnce([]);
      manager.update.mockRejectedValue(new Error('se cayó la base'));

      await expect(service.update('ing-1', { fatPer100g: 1 })).rejects.toThrow(
        'se cayó la base',
      );
    });
  });

  describe('remove', () => {
    it('elimina el ingrediente que no está en recetas', async () => {
      const huevo = buildIngredient();
      ingredients.findOneBy.mockResolvedValue(huevo);
      recipeIngredients.existsBy.mockResolvedValue(false);

      await service.remove('ing-1');

      expect(ingredients.remove).toHaveBeenCalledWith(huevo);
    });

    it('lanza Conflict si está en uso en alguna receta', async () => {
      ingredients.findOneBy.mockResolvedValue(buildIngredient());
      recipeIngredients.existsBy.mockResolvedValue(true);

      await expect(service.remove('ing-1')).rejects.toThrow(ConflictException);
      expect(ingredients.remove).not.toHaveBeenCalled();
    });
  });
});
