import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { Recipe } from '../recipes/entities/recipe.entity.js';
import { CategoriesService } from './categories.service.js';
import { Category } from './entities/category.entity.js';

describe('CategoriesService', () => {
  let service: CategoriesService;

  const categories = {
    find: vi.fn(),
    findOneBy: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  };
  const recipes = { existsBy: vi.fn() };

  const snack: Category = { id: 'cat-1', name: 'Snack' };
  const uniqueViolation = () =>
    new QueryFailedError(
      'INSERT',
      [],
      Object.assign(new Error('dup'), { code: '23505' }),
    );

  beforeEach(async () => {
    vi.resetAllMocks();
    categories.create.mockImplementation((data: object) => data);
    categories.save.mockImplementation((data: object) => ({
      id: 'cat-new',
      ...data,
    }));

    const moduleRef = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: getRepositoryToken(Category), useValue: categories },
        { provide: getRepositoryToken(Recipe), useValue: recipes },
      ],
    }).compile();

    service = moduleRef.get(CategoriesService);
  });

  it('findAll ordena por nombre', async () => {
    categories.find.mockResolvedValue([snack]);

    await expect(service.findAll()).resolves.toEqual([snack]);
    expect(categories.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
  });

  describe('findOne', () => {
    it('devuelve la categoría', async () => {
      categories.findOneBy.mockResolvedValue(snack);

      await expect(service.findOne('cat-1')).resolves.toEqual(snack);
    });

    it('lanza NotFound si no existe', async () => {
      categories.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('cat-x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('guarda la categoría si el nombre está libre', async () => {
      categories.findOneBy.mockResolvedValue(null);

      const created = await service.create({ name: 'Vegano' });

      expect(created).toEqual({ id: 'cat-new', name: 'Vegano' });
      expect(categories.save).toHaveBeenCalledWith({ name: 'Vegano' });
    });

    it('lanza Conflict si ya existe una con el mismo nombre (sin importar mayúsculas)', async () => {
      categories.findOneBy.mockResolvedValue(snack);

      await expect(service.create({ name: 'SNACK' })).rejects.toThrow(
        ConflictException,
      );
      expect(categories.save).not.toHaveBeenCalled();
    });

    it('lanza Conflict si la base rechaza el nombre repetido (peticiones simultáneas)', async () => {
      categories.findOneBy.mockResolvedValue(null);
      categories.save.mockRejectedValue(uniqueViolation());

      await expect(service.create({ name: 'Snack' })).rejects.toThrow(
        new ConflictException('Ya existe una categoría con ese nombre'),
      );
    });

    it('propaga otros errores de la base', async () => {
      categories.findOneBy.mockResolvedValue(null);
      categories.save.mockRejectedValue(new Error('se cayó la base'));

      await expect(service.create({ name: 'Snack' })).rejects.toThrow(
        'se cayó la base',
      );
    });
  });

  describe('update', () => {
    it('cambia el nombre', async () => {
      categories.findOneBy
        .mockResolvedValueOnce({ ...snack }) // findOne
        .mockResolvedValueOnce(null); // nombre libre

      const updated = await service.update('cat-1', { name: 'Meriendas' });

      expect(updated).toMatchObject({ id: 'cat-1', name: 'Meriendas' });
    });

    it('permite guardar el mismo nombre con otras mayúsculas (es la misma categoría)', async () => {
      categories.findOneBy
        .mockResolvedValueOnce({ ...snack })
        .mockResolvedValueOnce(snack);

      await expect(
        service.update('cat-1', { name: 'SNACK' }),
      ).resolves.toMatchObject({
        name: 'SNACK',
      });
    });

    it('lanza Conflict si el nombre es de otra categoría', async () => {
      categories.findOneBy
        .mockResolvedValueOnce({ ...snack })
        .mockResolvedValueOnce({ id: 'cat-2', name: 'Desayuno' });

      await expect(
        service.update('cat-1', { name: 'desayuno' }),
      ).rejects.toThrow(ConflictException);
    });

    it('lanza Conflict si la base rechaza el nombre repetido (peticiones simultáneas)', async () => {
      categories.findOneBy
        .mockResolvedValueOnce({ ...snack })
        .mockResolvedValueOnce(null);
      categories.save.mockRejectedValue(uniqueViolation());

      await expect(
        service.update('cat-1', { name: 'Desayuno' }),
      ).rejects.toThrow(
        new ConflictException('Ya existe una categoría con ese nombre'),
      );
    });

    it('con un body vacío no cambia nada', async () => {
      categories.findOneBy.mockResolvedValueOnce({ ...snack });

      await expect(service.update('cat-1', {})).resolves.toMatchObject(snack);
      expect(categories.findOneBy).toHaveBeenCalledTimes(1);
    });

    it('lanza NotFound si no existe', async () => {
      categories.findOneBy.mockResolvedValue(null);

      await expect(service.update('cat-x', { name: 'Nueva' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('elimina la categoría sin recetas', async () => {
      categories.findOneBy.mockResolvedValue(snack);
      recipes.existsBy.mockResolvedValue(false);

      await service.remove('cat-1');

      expect(recipes.existsBy).toHaveBeenCalledWith({ categoryId: 'cat-1' });
      expect(categories.remove).toHaveBeenCalledWith(snack);
    });

    it('lanza Conflict si tiene recetas', async () => {
      categories.findOneBy.mockResolvedValue(snack);
      recipes.existsBy.mockResolvedValue(true);

      await expect(service.remove('cat-1')).rejects.toThrow(ConflictException);
      expect(categories.remove).not.toHaveBeenCalled();
    });

    it('lanza NotFound si no existe', async () => {
      categories.findOneBy.mockResolvedValue(null);

      await expect(service.remove('cat-x')).rejects.toThrow(NotFoundException);
    });
  });
});
