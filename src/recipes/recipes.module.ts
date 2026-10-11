import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../categories/entities/category.entity.js';
import { Ingredient } from '../ingredients/entities/ingredient.entity.js';
import { MealPlanEntry } from '../meal-plan/entities/meal-plan-entry.entity.js';
import { RecipeIngredient } from './entities/recipe-ingredient.entity.js';
import { Recipe } from './entities/recipe.entity.js';
import { RecipesController } from './recipes.controller.js';
import { RecipesService } from './recipes.service.js';

@Module({
  // Solo se registran las entidades (no los módulos) para no crear dependencias circulares
  imports: [
    TypeOrmModule.forFeature([
      Recipe,
      RecipeIngredient,
      Category,
      Ingredient,
      MealPlanEntry,
    ]),
  ],
  controllers: [RecipesController],
  providers: [RecipesService],
  exports: [TypeOrmModule, RecipesService],
})
export class RecipesModule {}
