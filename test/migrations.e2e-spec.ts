import { DataSource } from 'typeorm';
import { buildDatabaseOptions } from '../src/database/database.config.js';
import { MIGRATIONS } from '../src/migrations/index.js';
import { createTestApp } from './support/test-app.js';

const EXPECTED_TABLES = [
  'categories',
  'ingredients',
  'meal_plan_entries',
  'meal_plans',
  'recipe_ingredients',
  'recipes',
  'revoked_tokens',
  'user_ingredients',
  'users',
];

describe('Migraciones (e2e)', () => {
  let dataSource: DataSource;

  const tables = async () => {
    const rows: { table_name: string }[] = await dataSource.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name <> 'migrations'
        ORDER BY table_name`,
    );
    return rows.map((r) => r.table_name);
  };

  beforeAll(async () => {
    // Se toma la lista de entidades de la app real: así, una entidad nueva queda incluida sola
    const { app, dataSource: appDataSource } = await createTestApp();
    const entities = appDataSource.entityMetadatas.map(
      (m) => m.target as Function,
    );
    await app.close();

    // Base vacía + solo migraciones (sin synchronize), como en producción
    dataSource = new DataSource({
      ...buildDatabaseOptions((key) => process.env[key]),
      entities,
      synchronize: false,
      migrationsRun: false,
      dropSchema: true,
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('en una base vacía no hay tablas', async () => {
    expect(await tables()).toEqual([]);
  });

  it('al ejecutar las migraciones se crean todas las tablas', async () => {
    const executed = await dataSource.runMigrations();

    expect(executed).toHaveLength(MIGRATIONS.length);
    expect(await tables()).toEqual(EXPECTED_TABLES);
  });

  it('el esquema de las migraciones coincide con las entidades (si falla, falta una migración)', async () => {
    const pending = await dataSource.driver.createSchemaBuilder().log();

    expect(pending.upQueries.map((q) => q.query)).toEqual([]);
  });

  it('las tablas creadas por migración funcionan: respetan las llaves foráneas', async () => {
    await dataSource.query(
      `INSERT INTO users (email, password) VALUES ('a@example.com', 'x')`,
    );
    const [user] = await dataSource.query(`SELECT id FROM users LIMIT 1`);
    await dataSource.query(
      `INSERT INTO meal_plans ("userId", "weekStartDate") VALUES ($1, '2026-10-05')`,
      [user.id],
    );

    // Un plan sin usuario válido viola la llave foránea
    await expect(
      dataSource.query(
        `INSERT INTO meal_plans ("userId", "weekStartDate") VALUES (gen_random_uuid(), '2026-10-12')`,
      ),
    ).rejects.toThrow(/foreign key/i);
  });

  it('los nombres del catálogo son únicos sin distinguir mayúsculas', async () => {
    const indexes: { indexname: string }[] = await dataSource.query(
      `SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND indexname LIKE 'IDX_%_name_lower'
        ORDER BY indexname`,
    );
    expect(indexes.map((i) => i.indexname)).toEqual([
      'IDX_categories_name_lower',
      'IDX_ingredients_name_lower',
      'IDX_recipes_name_lower',
    ]);

    await dataSource.query(`INSERT INTO categories (name) VALUES ('Snack')`);
    await expect(
      dataSource.query(`INSERT INTO categories (name) VALUES ('SNACK')`),
    ).rejects.toThrow(/IDX_categories_name_lower/);
  });

  it('se pueden revertir: la base vuelve a quedar sin tablas', async () => {
    // Se revierten una por una, de la última a la primera
    for (let i = 0; i < MIGRATIONS.length; i++) {
      await dataSource.undoLastMigration();
    }

    expect(await tables()).toEqual([]);
  });
});
