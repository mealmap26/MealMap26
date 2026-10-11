import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { RecipeIngredient } from '../recipes/entities/recipe-ingredient.entity.js';
import { Recipe } from '../recipes/entities/recipe.entity.js';
import { Unit } from '../recipes/enums/unit.enum.js';
import { Ingredient } from './entities/ingredient.entity.js';
import { IngredientsService } from './ingredients.service.js';

describe('IngredientsService', () => {
  let service: IngredientsService;

  const manager = {
    getRepository: vi.fn(),
    save: vi.fn(),
    find: vi.fn(),
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

  const uniqueViolation = () =>
    new QueryFailedError(
      'INSERT',
      [],
      Object.assign(new Error('dup'), { code: '23505' }),
    );

  const buildIngredient = (
    overrides: Partial<Ingredient> = {},
  ): Ingredient => ({
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
    ingredients.save.mockImplementation((data: object) => ({
      id: 'ing-new',
      ...data,
    }));
    ingredients.merge.mockImplementation((target: object, data: object) =>
      Object.assign(target, data),
    );
    ingredients.manager.transaction.mockImplementation(
      (callback: (m: typeof manager) => Promise<unknown>) => callback(manager),
    );
    manager.save.mockImplementation(
      (_target: unknown, data?: object) => data ?? _target,
    );
    manager.getRepository.mockReturnValue(ingredients);

    const moduleRef = await Test.createTestingModule({
      providers: [
        IngredientsService,
        { provide: getRepositoryToken(Ingredient), useValue: ingredients },
        {
          provide: getRepositoryToken(RecipeIngredient),
          useValue: recipeIngredients,
        },
      ],
    }).compile();

    service = moduleRef.get(IngredientsService);
  });

  describe('findAll', () => {
    it('sin búsqueda lista todos ordenados por nombre', async () => {
      ingredients.find.mockResolvedValue([]);

      await service.findAll();

      expect(ingredients.find).toHaveBeenCalledWith({
        where: {},
        order: { name: 'ASC' },
      });
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
      const {
        id: _id,
        gramsPerUnit: _g,
        ...dto
      } = buildIngredient({ name: 'Quinua' });

      const created = await service.create(dto);

      expect(created).toMatchObject({
        id: 'ing-new',
        name: 'Quinua',
        gramsPerUnit: null,
      });
    });

    it('lanza Conflict si el nombre ya existe', async () => {
      ingredients.findOneBy.mockResolvedValue(buildIngredient());
      const { id: _id, ...dto } = buildIngredient({ name: 'HUEVO' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('lanza Conflict si la base rechaza el nombre repetido (peticiones simultáneas)', async () => {
      ingredients.findOneBy.mockResolvedValue(null);
      ingredients.save.mockRejectedValue(uniqueViolation());
      const { id: _id, ...dto } = buildIngredient({ name: 'Huevo' });

      await expect(service.create(dto)).rejects.toThrow(
        new ConflictException('Ya existe un ingrediente con ese nombre'),
      );
    });
  });

  describe('update', () => {
    it('si solo cambia el nombre no recalcula recetas', async () => {
      ingredients.findOneBy
        .mockResolvedValueOnce(buildIngredient())
        .mockResolvedValueOnce(null);

      const updated = await service.update('ing-1', {
        name: 'Huevo de gallina',
      });

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

    it('lanza NotFound si no existe', async () => {
      ingredients.findOneBy.mockResolvedValueOnce(null);

      await expect(service.update('ing-x', { name: 'Nuevo' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza Conflict si la base rechaza el nombre repetido (peticiones simultáneas)', async () => {
      ingredients.findOneBy
        .mockResolvedValueOnce(buildIngredient())
        .mockResolvedValueOnce(null);
      manager.save.mockRejectedValueOnce(uniqueViolation());

      await expect(service.update('ing-1', { name: 'Leche' })).rejects.toThrow(
        new ConflictException('Ya existe un ingrediente con ese nombre'),
      );
    });

    it('si cambian los macros recalcula y guarda en un solo save los macros de las recetas que lo usan', async () => {
      ingredients.findOneBy.mockResolvedValueOnce(buildIngredient());
      const nuevo = buildIngredient({ caloriesPer100g: 200 });
      const leche = buildIngredient({
        id: 'ing-2',
        name: 'Leche',
        caloriesPer100g: 42,
        proteinPer100g: 3.4,
        carbsPer100g: 5,
        fatPer100g: 1,
        gramsPerUnit: null,
      });
      const pericos = { id: 'r1', name: 'Pericos', servingSize: 2 };
      const batido = { id: 'r2', name: 'Batido', servingSize: 1 };
      manager.find.mockResolvedValueOnce([
        {
          recipeId: 'r1',
          recipe: pericos,
          quantity: 4,
          unit: Unit.UNIT,
          ingredient: nuevo,
        },
        {
          recipeId: 'r2',
          recipe: batido,
          quantity: 1,
          unit: Unit.UNIT,
          ingredient: nuevo,
        },
        {
          recipeId: 'r2',
          recipe: batido,
          quantity: 100,
          unit: Unit.MILLILITERS,
          ingredient: leche,
        },
      ]);

      await service.update('ing-1', { caloriesPer100g: 200 });

      expect(manager.find).toHaveBeenCalledTimes(1);
      expect(manager.find).toHaveBeenCalledWith(
        RecipeIngredient,
        expect.objectContaining({
          relations: { recipe: true, ingredient: true },
        }),
      );
      // Pericos: 4 huevos x 50 g = 200 g -> 400 kcal, entre 2 porciones.
      // Batido: 1 huevo (50 g -> 100 kcal) + 100 ml de leche (42 kcal), 1 porción.
      expect(manager.save).toHaveBeenLastCalledWith(Recipe, [
        { id: 'r1', calories: 200, protein: 12.6, carbs: 0.7, fat: 9.5 },
        { id: 'r2', calories: 142, protein: 9.7, carbs: 5.35, fat: 5.75 },
      ]);
    });

    it('si cambian los macros pero ninguna receta lo usa no guarda recetas', async () => {
      ingredients.findOneBy.mockResolvedValueOnce(buildIngredient());
      manager.find.mockResolvedValueOnce([]);

      await service.update('ing-1', { fatPer100g: 10 });

      expect(manager.find).toHaveBeenCalledTimes(1);
      expect(manager.save).toHaveBeenCalledTimes(1);
    });

    it("lanza BadRequest si se quita gramsPerUnit y una receta lo usa en 'unidad'", async () => {
      ingredients.findOneBy.mockResolvedValueOnce(buildIngredient());
      const sinPeso = buildIngredient({ gramsPerUnit: null });
      manager.find.mockResolvedValueOnce([
        {
          recipeId: 'r1',
          recipe: { id: 'r1', name: 'Pericos', servingSize: 1 },
          quantity: 2,
          unit: Unit.UNIT,
          ingredient: sinPeso,
        },
      ]);

      await expect(
        service.update('ing-1', { gramsPerUnit: null }),
      ).rejects.toThrow(BadRequestException);
    });

    it('propaga otros errores del recálculo', async () => {
      ingredients.findOneBy.mockResolvedValueOnce(buildIngredient());
      manager.find.mockResolvedValueOnce([
        {
          recipeId: 'r1',
          recipe: { id: 'r1', name: 'Pericos', servingSize: 1 },
          quantity: 1,
          unit: Unit.GRAMS,
          ingredient: null,
        },
      ]);

      await expect(service.update('ing-1', { fatPer100g: 1 })).rejects.toThrow(
        TypeError,
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
