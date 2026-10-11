import { InitialSchema1791735925232 } from './1791735925232-InitialSchema.js';
import { AddIngredientGramsPerUnit1791800000000 } from './1791800000000-AddIngredientGramsPerUnit.js';
import { AddLowerNameUniqueIndexes1791900000000 } from './1791900000000-AddLowerNameUniqueIndexes.js';

// Migraciones de TypeORM, en orden. Al crear una nueva con `npm run migration:generate`,
// hay que importarla aquí y agregarla a la lista.
export const MIGRATIONS = [
  InitialSchema1791735925232,
  AddIngredientGramsPerUnit1791800000000,
  AddLowerNameUniqueIndexes1791900000000,
];
