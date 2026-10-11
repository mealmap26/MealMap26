import { ConflictException } from '@nestjs/common';
import { FindOptionsWhere, Raw, Repository } from 'typeorm';

interface Named {
  id: string;
  name: string;
}

// Busca por nombre sin distinguir mayúsculas ("Snack" y "snack" son el mismo nombre)
export function findByNameIgnoringCase<T extends Named>(
  repository: Repository<T>,
  name: string,
): Promise<T | null> {
  return repository.findOneBy({
    name: Raw((alias) => `LOWER(${alias}) = LOWER(:name)`, { name }),
  } as FindOptionsWhere<T>);
}

// Lanza 409 si otro registro ya usa el nombre. Esta verificación da el mensaje claro; el
// índice único sobre LOWER("name") es el que garantiza la unicidad ante peticiones simultáneas.
export async function ensureNameIsFree<T extends Named>(
  repository: Repository<T>,
  name: string,
  message: string,
  excludeId?: string,
): Promise<void> {
  const existing = await findByNameIgnoringCase(repository, name);
  if (existing && existing.id !== excludeId) {
    throw new ConflictException(message);
  }
}
