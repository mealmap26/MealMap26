import type { DataSourceOptions } from 'typeorm';
import { MIGRATIONS } from '../migrations/index.js';

type EnvGetter = (key: string) => string | undefined;
type PostgresOptions = Extract<DataSourceOptions, { type: 'postgres' }>;

// Configuración de la base de datos compartida por la app (app.module.ts) y por el CLI de migraciones.
//
// - Desarrollo y pruebas: `synchronize` crea las tablas a partir de las entidades.
// - Producción: no se usa `synchronize`; las tablas se crean ejecutando las migraciones al arrancar.
// - Conexión: si existe DATABASE_URL (Render y Railway la entregan) se usa esa; si no, DB_HOST,
//   DB_PORT, DB_USER, DB_PASSWORD y DB_NAME. DB_SSL=true activa SSL (necesario para conectarse
//   a la base de Render desde fuera de su red).
export function buildDatabaseOptions(get: EnvGetter): PostgresOptions {
  const isProduction = get('NODE_ENV') === 'production';
  const url = get('DATABASE_URL');

  return {
    type: 'postgres',
    ...(url
      ? { url }
      : {
          host: get('DB_HOST'),
          port: Number(get('DB_PORT')),
          username: get('DB_USER'),
          password: get('DB_PASSWORD'),
          database: get('DB_NAME'),
        }),
    ssl: get('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
    synchronize: !isProduction,
    migrations: MIGRATIONS,
    migrationsRun: isProduction,
  };
}
