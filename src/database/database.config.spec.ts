import { MIGRATIONS } from '../migrations/index.js';
import { buildDatabaseOptions } from './database.config.js';

// Construye un "getter" de variables de entorno a partir de un objeto
const env = (values: Record<string, string>) => (key: string) => values[key];

const separateVars = {
  DB_HOST: 'localhost',
  DB_PORT: '5442',
  DB_USER: 'mealmap',
  DB_PASSWORD: 'secreto',
  DB_NAME: 'mealmap',
};

describe('buildDatabaseOptions', () => {
  describe('conexión', () => {
    it('usa las variables DB_* cuando no hay DATABASE_URL', () => {
      const options = buildDatabaseOptions(env(separateVars));

      expect(options).toMatchObject({
        type: 'postgres',
        host: 'localhost',
        port: 5442,
        username: 'mealmap',
        password: 'secreto',
        database: 'mealmap',
      });
      expect(options).not.toHaveProperty('url');
    });

    it('convierte el puerto a número', () => {
      const options = buildDatabaseOptions(env(separateVars));

      expect(options).toHaveProperty('port', 5442);
    });

    it('usa DATABASE_URL cuando existe, aunque haya variables DB_*', () => {
      const url = 'postgresql://user:pass@dpg-abc.render.com:5432/mealmap_prod';

      const options = buildDatabaseOptions(env({ ...separateVars, DATABASE_URL: url }));

      expect(options).toMatchObject({ type: 'postgres', url });
      expect(options).not.toHaveProperty('host');
    });
  });

  describe('SSL', () => {
    it('está desactivado por defecto', () => {
      expect(buildDatabaseOptions(env(separateVars)).ssl).toBe(false);
    });

    it('se activa con DB_SSL=true', () => {
      const options = buildDatabaseOptions(env({ ...separateVars, DB_SSL: 'true' }));

      expect(options.ssl).toEqual({ rejectUnauthorized: false });
    });

    it('cualquier otro valor de DB_SSL lo deja desactivado', () => {
      expect(buildDatabaseOptions(env({ ...separateVars, DB_SSL: 'false' })).ssl).toBe(false);
    });
  });

  describe('esquema', () => {
    it.each(['development', 'test', undefined])(
      'en %s se crea con synchronize y no corre migraciones',
      (nodeEnv) => {
        const values = nodeEnv ? { ...separateVars, NODE_ENV: nodeEnv } : separateVars;

        const options = buildDatabaseOptions(env(values));

        expect(options.synchronize).toBe(true);
        expect(options.migrationsRun).toBe(false);
      },
    );

    it('en producción NO usa synchronize y corre las migraciones al arrancar', () => {
      const options = buildDatabaseOptions(env({ ...separateVars, NODE_ENV: 'production' }));

      expect(options.synchronize).toBe(false);
      expect(options.migrationsRun).toBe(true);
    });

    it('registra las migraciones del proyecto', () => {
      const options = buildDatabaseOptions(env(separateVars));

      expect(options.migrations).toBe(MIGRATIONS);
      expect(MIGRATIONS.length).toBeGreaterThan(0);
    });
  });
});
