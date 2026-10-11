import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1791735925232 implements MigrationInterface {
  name = 'InitialSchema1791735925232';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "revoked_tokens" ("jti" character varying NOT NULL, "expiresAt" TIMESTAMP NOT NULL, CONSTRAINT "PK_b18aa48269f87cafba8c6310624" PRIMARY KEY ("jti"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, CONSTRAINT "UQ_8b0be371d28245da6e4f4b61878" UNIQUE ("name"), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('ADMIN', 'USER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'USER', "twoFASecret" character varying, "twoFAEnabled" boolean NOT NULL DEFAULT false, "dailyCalories" integer, "dailyProtein" integer, "dailyCarbs" integer, "dailyFat" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "ingredients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "caloriesPer100g" numeric(7,2) NOT NULL, "proteinPer100g" numeric(7,2) NOT NULL, "carbsPer100g" numeric(7,2) NOT NULL, "fatPer100g" numeric(7,2) NOT NULL, CONSTRAINT "UQ_a955029b22ff66ae9fef2e161f8" UNIQUE ("name"), CONSTRAINT "PK_9240185c8a5507251c9f15e0649" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_ingredients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "ingredientId" uuid NOT NULL, CONSTRAINT "UQ_2fd8defc35fda78b4c0498cd9a2" UNIQUE ("userId", "ingredientId"), CONSTRAINT "PK_771b252ad11843b0e61d77d9525" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "meal_plans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "weekStartDate" date NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a33d2fba1be47c206cb41444798" UNIQUE ("userId", "weekStartDate"), CONSTRAINT "PK_6270d3206d074e2a2520f8d0a0b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "recipes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text, "prepTimeMinutes" integer NOT NULL, "calories" numeric(7,2) NOT NULL, "protein" numeric(7,2) NOT NULL, "carbs" numeric(7,2) NOT NULL, "fat" numeric(7,2) NOT NULL, "servingSize" integer NOT NULL DEFAULT '1', "categoryId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8f09680a51bf3669c1598a21682" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."meal_plan_entries_mealtype_enum" AS ENUM('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK')`,
    );
    await queryRunner.query(
      `CREATE TABLE "meal_plan_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "mealPlanId" uuid NOT NULL, "recipeId" uuid NOT NULL, "dayOfWeek" smallint NOT NULL, "mealType" "public"."meal_plan_entries_mealtype_enum" NOT NULL, CONSTRAINT "CHK_f49214189c7d172f21032a696d" CHECK ("dayOfWeek" BETWEEN 1 AND 7), CONSTRAINT "PK_8384d591c94bb96697f81749b09" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."recipe_ingredients_unit_enum" AS ENUM('g', 'ml', 'unidad')`,
    );
    await queryRunner.query(
      `CREATE TABLE "recipe_ingredients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "recipeId" uuid NOT NULL, "ingredientId" uuid NOT NULL, "quantity" numeric(8,2) NOT NULL, "unit" "public"."recipe_ingredients_unit_enum" NOT NULL, CONSTRAINT "UQ_77d03a398e85d333b09b22cda91" UNIQUE ("recipeId", "ingredientId"), CONSTRAINT "PK_8f15a314e55970414fc92ffb532" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_ingredients" ADD CONSTRAINT "FK_ebcc5199a19f8f679f011cff745" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_ingredients" ADD CONSTRAINT "FK_bc9511b3e66109c481cbe7c8af3" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "meal_plans" ADD CONSTRAINT "FK_1ce69a2fecf3cefd6a986c452c4" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "recipes" ADD CONSTRAINT "FK_d4097844785f4a027db682aa671" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "FK_04054fc6ab06c6e4808a0f12a4e" FOREIGN KEY ("mealPlanId") REFERENCES "meal_plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "FK_a87c81bcb6a3310b0648e79032f" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "FK_2d7f407ae694e91bb3da1798c61" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "FK_05a2b62604dfd9840f4cda76a93" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "recipe_ingredients" DROP CONSTRAINT "FK_05a2b62604dfd9840f4cda76a93"`,
    );
    await queryRunner.query(
      `ALTER TABLE "recipe_ingredients" DROP CONSTRAINT "FK_2d7f407ae694e91bb3da1798c61"`,
    );
    await queryRunner.query(
      `ALTER TABLE "meal_plan_entries" DROP CONSTRAINT "FK_a87c81bcb6a3310b0648e79032f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "meal_plan_entries" DROP CONSTRAINT "FK_04054fc6ab06c6e4808a0f12a4e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "recipes" DROP CONSTRAINT "FK_d4097844785f4a027db682aa671"`,
    );
    await queryRunner.query(
      `ALTER TABLE "meal_plans" DROP CONSTRAINT "FK_1ce69a2fecf3cefd6a986c452c4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_ingredients" DROP CONSTRAINT "FK_bc9511b3e66109c481cbe7c8af3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_ingredients" DROP CONSTRAINT "FK_ebcc5199a19f8f679f011cff745"`,
    );
    await queryRunner.query(`DROP TABLE "recipe_ingredients"`);
    await queryRunner.query(
      `DROP TYPE "public"."recipe_ingredients_unit_enum"`,
    );
    await queryRunner.query(`DROP TABLE "meal_plan_entries"`);
    await queryRunner.query(
      `DROP TYPE "public"."meal_plan_entries_mealtype_enum"`,
    );
    await queryRunner.query(`DROP TABLE "recipes"`);
    await queryRunner.query(`DROP TABLE "meal_plans"`);
    await queryRunner.query(`DROP TABLE "user_ingredients"`);
    await queryRunner.query(`DROP TABLE "ingredients"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`DROP TABLE "revoked_tokens"`);
  }
}
