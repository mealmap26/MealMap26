import { MigrationInterface, QueryRunner } from 'typeorm';

// Peso de una unidad de ingrediente; permite calcular los macros de las recetas en 'unidad'
export class AddIngredientGramsPerUnit1791800000000 implements MigrationInterface {
  name = 'AddIngredientGramsPerUnit1791800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ingredients" ADD "gramsPerUnit" numeric(7,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ingredients" DROP COLUMN "gramsPerUnit"`,
    );
  }
}
