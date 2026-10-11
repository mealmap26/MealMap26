import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UpdateMacrosDto } from './dto/update-macros.dto.js';
import { User } from './entities/user.entity.js';
import { Role } from './enums/role.enum.js';
import { UsersService } from './users.service.js';

describe('UsersService.updateMacros', () => {
  let service: UsersService;

  const usersRepository = {
    update: vi.fn(),
    findOneByOrFail: vi.fn(),
  };

  const storedUser = {
    id: 'user-1',
    email: 'ana@example.com',
    dailyCalories: 2000,
    dailyProtein: 150,
    dailyCarbs: null,
    dailyFat: null,
  };

  // Como llega del ValidationPipe: las propiedades no enviadas existen con valor undefined
  const buildDto = (values: Partial<UpdateMacrosDto>): UpdateMacrosDto =>
    Object.assign(new UpdateMacrosDto(), {
      dailyCalories: undefined,
      dailyProtein: undefined,
      dailyCarbs: undefined,
      dailyFat: undefined,
      ...values,
    });

  beforeEach(async () => {
    vi.resetAllMocks();
    usersRepository.findOneByOrFail.mockResolvedValue(storedUser);

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: usersRepository },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  it('actualiza solo las metas enviadas', async () => {
    await service.updateMacros(
      'user-1',
      buildDto({ dailyCalories: 2000, dailyProtein: 150 }),
    );

    expect(usersRepository.update).toHaveBeenCalledWith('user-1', {
      dailyCalories: 2000,
      dailyProtein: 150,
    });
  });

  it('no toca la base si no se envió ninguna meta', async () => {
    await service.updateMacros('user-1', buildDto({}));

    expect(usersRepository.update).not.toHaveBeenCalled();
  });

  it('guarda una meta en 0 (no la confunde con "no enviada")', async () => {
    await service.updateMacros('user-1', buildDto({ dailyFat: 0 }));

    expect(usersRepository.update).toHaveBeenCalledWith('user-1', {
      dailyFat: 0,
    });
  });

  it('devuelve las 4 metas, con null en las que aún no están configuradas', async () => {
    const result = await service.updateMacros(
      'user-1',
      buildDto({ dailyCalories: 2000 }),
    );

    expect(result).toEqual({
      dailyCalories: 2000,
      dailyProtein: 150,
      dailyCarbs: null,
      dailyFat: null,
    });
  });

  it('no expone otros datos del usuario como el email', async () => {
    const result = await service.updateMacros(
      'user-1',
      buildDto({ dailyCalories: 2000 }),
    );

    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('id');
  });
});

describe('UsersService: administración de roles', () => {
  let service: UsersService;

  const usersRepository = {
    find: vi.fn(),
    findOneBy: vi.fn(),
    update: vi.fn(),
  };

  const createdAt = new Date('2026-10-01T12:00:00.000Z');

  // Como lo devuelve TypeORM: password y twoFASecret no se seleccionan, pero el resto sí
  const storedUser = {
    id: 'user-1',
    email: 'ana@example.com',
    role: Role.USER,
    twoFAEnabled: false,
    dailyCalories: 2000,
    dailyProtein: null,
    dailyCarbs: null,
    dailyFat: null,
    createdAt,
  };

  beforeEach(async () => {
    vi.resetAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: usersRepository },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  describe('findAll', () => {
    it('lista los usuarios por fecha de creación con solo los datos públicos', async () => {
      usersRepository.find.mockResolvedValue([
        { ...storedUser, password: 'hash', twoFASecret: 'secreto' },
      ]);

      const result = await service.findAll();

      expect(usersRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'ASC', email: 'ASC' },
      });
      expect(result).toEqual([
        {
          id: 'user-1',
          email: 'ana@example.com',
          role: Role.USER,
          twoFAEnabled: false,
          createdAt,
        },
      ]);
    });
  });

  describe('changeRole', () => {
    it('cambia el rol y devuelve el usuario con el rol nuevo', async () => {
      usersRepository.findOneBy.mockResolvedValue({ ...storedUser });

      const result = await service.changeRole('admin-1', 'user-1', Role.ADMIN);

      expect(usersRepository.update).toHaveBeenCalledWith('user-1', {
        role: Role.ADMIN,
      });
      expect(result).toEqual({
        id: 'user-1',
        email: 'ana@example.com',
        role: Role.ADMIN,
        twoFAEnabled: false,
        createdAt,
      });
    });

    it('con el mismo rol no toca la base y devuelve el usuario (idempotente)', async () => {
      usersRepository.findOneBy.mockResolvedValue({ ...storedUser });

      const result = await service.changeRole('admin-1', 'user-1', Role.USER);

      expect(usersRepository.update).not.toHaveBeenCalled();
      expect(result.role).toBe(Role.USER);
    });

    it('responde 404 si el usuario no existe', async () => {
      usersRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.changeRole('admin-1', 'missing', Role.ADMIN),
      ).rejects.toThrow(new NotFoundException('Usuario no encontrado'));
      expect(usersRepository.update).not.toHaveBeenCalled();
    });

    it('responde 400 si el admin intenta cambiar su propio rol', async () => {
      await expect(
        service.changeRole('admin-1', 'admin-1', Role.USER),
      ).rejects.toThrow(BadRequestException);
      expect(usersRepository.findOneBy).not.toHaveBeenCalled();
      expect(usersRepository.update).not.toHaveBeenCalled();
    });
  });
});
