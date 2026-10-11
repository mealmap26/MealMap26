import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { Category } from '../categories/entities/category.entity.js';
import { Ingredient } from '../ingredients/entities/ingredient.entity.js';
import { RecipeIngredient } from '../recipes/entities/recipe-ingredient.entity.js';
import { Recipe } from '../recipes/entities/recipe.entity.js';
import { computeMacrosPerServing } from '../recipes/recipe-macros.js';
import { User } from '../users/entities/user.entity.js';
import { Role } from '../users/enums/role.enum.js';
import { CATEGORIES } from './data/categories.data.js';
import { INGREDIENTS, IngredientSeed } from './data/ingredients.data.js';
import { RECIPES, RecipeSeed } from './data/recipes.data.js';

interface Counter {
  created: number;
  skipped: number;
}

export interface SeedSummary {
  categories: Counter;
  ingredients: Counter;
  recipes: Counter;
  admin: Counter;
}

const BCRYPT_ROUNDS = 10;

@Injectable()
export class SeedService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  // Idempotente: crea solo lo que no existe y nunca sobrescribe datos existentes.
  async run(): Promise<SeedSummary> {
    const adminEmail = this.config
      .getOrThrow<string>('ADMIN_EMAIL')
      .trim()
      .toLowerCase();
    const adminPassword = this.config.getOrThrow<string>('ADMIN_PASSWORD');

    return this.dataSource.transaction(async (manager) => {
      const summary: SeedSummary = {
        categories: { created: 0, skipped: 0 },
        ingredients: { created: 0, skipped: 0 },
        recipes: { created: 0, skipped: 0 },
        admin: { created: 0, skipped: 0 },
      };

      // Categorías
      const categories = new Map<string, Category>();
      for (const name of CATEGORIES) {
        let category = await manager.findOneBy(Category, { name });
        if (category) {
          summary.categories.skipped++;
        } else {
          category = await manager.save(manager.create(Category, { name }));
          summary.categories.created++;
        }
        categories.set(name, category);
      }

      // Ingredientes
      const ingredients = new Map<string, Ingredient>();
      for (const data of INGREDIENTS) {
        let ingredient = await manager.findOneBy(Ingredient, { name: data.name });
        if (ingredient) {
          summary.ingredients.skipped++;
        } else {
          ingredient = await manager.save(
            manager.create(Ingredient, {
              ...data,
              gramsPerUnit: data.gramsPerUnit ?? null,
            }),
          );
          summary.ingredients.created++;
        }
        ingredients.set(data.name, ingredient);
      }

      // Recetas (con sus ingredientes y macros por porción calculados)
      const seedByIngredient = new Map(INGREDIENTS.map((i) => [i.name, i]));
      for (const seed of RECIPES) {
        if (await manager.existsBy(Recipe, { name: seed.name })) {
          summary.recipes.skipped++;
          continue;
        }

        const category = categories.get(seed.category);
        if (!category) {
          throw new Error(`Categoría inexistente en el seed: ${seed.category}`);
        }

        const recipe = await manager.save(
          manager.create(Recipe, {
            name: seed.name,
            description: seed.description,
            prepTimeMinutes: seed.prepTimeMinutes,
            servingSize: seed.servingSize,
            categoryId: category.id,
            ...this.macrosOf(seed, seedByIngredient),
          }),
        );

        const rows = seed.ingredients.map((line) => {
          const ingredient = ingredients.get(line.ingredient);
          if (!ingredient) {
            throw new Error(`Ingrediente inexistente en el seed: ${line.ingredient}`);
          }
          return manager.create(RecipeIngredient, {
            recipeId: recipe.id,
            ingredientId: ingredient.id,
            quantity: line.quantity,
            unit: line.unit,
          });
        });
        await manager.save(rows);
        summary.recipes.created++;
      }

      // Usuario administrador
      if (await manager.existsBy(User, { email: adminEmail })) {
        summary.admin.skipped++;
      } else {
        await manager.save(
          manager.create(User, {
            email: adminEmail,
            password: await bcrypt.hash(adminPassword, BCRYPT_ROUNDS),
            role: Role.ADMIN,
          }),
        );
        summary.admin.created++;
      }

      return summary;
    });
  }

  // Macros por porción con los valores del archivo del seed (no con los de la base,
  // para que el resultado no dependa de cambios hechos después por un ADMIN)
  private macrosOf(
    recipe: RecipeSeed,
    seedByIngredient: Map<string, IngredientSeed>,
  ) {
    const lines = recipe.ingredients.map((line) => {
      const data = seedByIngredient.get(line.ingredient);
      if (!data) {
        throw new Error(`Ingrediente inexistente en el seed: ${line.ingredient}`);
      }
      return { quantity: line.quantity, unit: line.unit, ingredient: data };
    });
    return computeMacrosPerServing(lines, recipe.servingSize);
  }
}
