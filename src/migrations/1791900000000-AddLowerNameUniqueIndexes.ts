import { MigrationInterface, QueryRunner } from 'typeorm';

// Nombres únicos sin distinguir mayúsculas en el catálogo ("Snack" y "snack" chocan).
// Los servicios verifican antes de guardar, pero solo el índice evita duplicados cuando
// llegan dos peticiones al mismo tiempo. Las entidades los declaran con synchronize: false
// porque TypeORM no sabe crear índices sobre expresiones.
export class AddLowerNameUniqueIndexes1791900000000 implements MigrationInterface {
  name = 'AddLowerNameUniqueIndexes1791900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_categories_name_lower" ON "categories" (LOWER("name"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ingredients_name_lower" ON "ingredients" (LOWER("name"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_recipes_name_lower" ON "recipes" (LOWER("name"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_recipes_name_lower"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ingredients_name_lower"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_categories_name_lower"`);
  }
}
