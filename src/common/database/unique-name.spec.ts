import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ensureNameIsFree, findByNameIgnoringCase } from './unique-name.js';

interface Named {
  id: string;
  name: string;
}

describe('nombres únicos sin distinguir mayúsculas', () => {
  const findOneBy = vi.fn();
  const repository = { findOneBy } as unknown as Repository<Named>;

  beforeEach(() => vi.resetAllMocks());

  it('findByNameIgnoringCase compara en minúsculas', async () => {
    findOneBy.mockResolvedValue({ id: '1', name: 'Snack' });

    await expect(findByNameIgnoringCase(repository, 'SNACK')).resolves.toEqual({
      id: '1',
      name: 'Snack',
    });
    const { name } = findOneBy.mock.calls[0][0];
    expect(name.getSql('"name"')).toBe('LOWER("name") = LOWER(:name)');
    expect(name.objectLiteralParameters).toEqual({ name: 'SNACK' });
  });

  it('ensureNameIsFree no lanza si el nombre está libre', async () => {
    findOneBy.mockResolvedValue(null);

    await expect(
      ensureNameIsFree(repository, 'Nuevo', 'dup'),
    ).resolves.toBeUndefined();
  });

  it('ensureNameIsFree permite el nombre del mismo registro', async () => {
    findOneBy.mockResolvedValue({ id: '1', name: 'Snack' });

    await expect(
      ensureNameIsFree(repository, 'snack', 'dup', '1'),
    ).resolves.toBeUndefined();
  });

  it('ensureNameIsFree lanza Conflict si el nombre es de otro registro', async () => {
    findOneBy.mockResolvedValue({ id: '2', name: 'Snack' });

    await expect(
      ensureNameIsFree(repository, 'snack', 'Ya existe', '1'),
    ).rejects.toThrow(new ConflictException('Ya existe'));
  });
});
