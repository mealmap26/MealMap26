import { config } from 'dotenv';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { buildDatabaseOptions } from './database.config.js';

// Solo lo usa el CLI de TypeORM (npm run migration:generate | migration:run | migration:revert).
// La app en ejecución se conecta con la configuración de app.module.ts.
config({ quiet: true });

export default new DataSource({
  ...buildDatabaseOptions((key) => process.env[key]),
  // El CLI necesita saber dónde están las entidades para compararlas con la base
  entities: [join(import.meta.dirname, '..', '**', '*.entity.js')],
  synchronize: false,
  migrationsRun: false,
});
