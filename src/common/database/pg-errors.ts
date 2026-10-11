import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

// Códigos de error de PostgreSQL que la app traduce a respuestas HTTP
export const PG_UNIQUE_VIOLATION = '23505';
export const PG_FOREIGN_KEY_VIOLATION = '23503';

// Indica si el error viene de PostgreSQL con el código dado
export function isPgError(error: unknown, code: string): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code === code
  );
}

// Ejecuta la escritura y, si la base la rechaza por una restricción única, responde 409.
// Cubre las peticiones simultáneas que pasan la verificación previa al mismo tiempo.
export async function conflictOnUniqueViolation<T>(
  write: () => Promise<T>,
  message: string,
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isPgError(error, PG_UNIQUE_VIOLATION)) {
      throw new ConflictException(message);
    }
    throw error;
  }
}
