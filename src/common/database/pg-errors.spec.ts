import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import {
  conflictOnUniqueViolation,
  isPgError,
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
} from './pg-errors.js';

const pgError = (code: string) =>
  new QueryFailedError('INSERT', [], Object.assign(new Error('pg'), { code }));

describe('isPgError', () => {
  it('reconoce el código del error de PostgreSQL', () => {
    expect(isPgError(pgError(PG_UNIQUE_VIOLATION), PG_UNIQUE_VIOLATION)).toBe(
      true,
    );
    expect(
      isPgError(pgError(PG_FOREIGN_KEY_VIOLATION), PG_UNIQUE_VIOLATION),
    ).toBe(false);
  });

  it('descarta errores que no vienen de la base', () => {
    expect(isPgError(new Error('otro'), PG_UNIQUE_VIOLATION)).toBe(false);
    expect(isPgError(undefined, PG_UNIQUE_VIOLATION)).toBe(false);
  });
});

describe('conflictOnUniqueViolation', () => {
  it('devuelve el resultado de la escritura', async () => {
    await expect(
      conflictOnUniqueViolation(async () => 'ok', 'dup'),
    ).resolves.toBe('ok');
  });

  it('traduce la violación de unicidad a Conflict con el mensaje dado', async () => {
    const write = conflictOnUniqueViolation(async () => {
      throw pgError(PG_UNIQUE_VIOLATION);
    }, 'Ya existe');

    await expect(write).rejects.toThrow(ConflictException);
    await expect(write).rejects.toThrow('Ya existe');
  });

  it('propaga los demás errores', async () => {
    await expect(
      conflictOnUniqueViolation(async () => {
        throw pgError(PG_FOREIGN_KEY_VIOLATION);
      }, 'Ya existe'),
    ).rejects.toThrow(QueryFailedError);
  });
});
