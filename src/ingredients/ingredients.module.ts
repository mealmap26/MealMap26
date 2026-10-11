import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecipeIngredient } from '../recipes/entities/recipe-ingredient.entity.js';
import { Ingredient } from './entities/ingredient.entity.js';
import { IngredientsController } from './ingredients.controller.js';
import { IngredientsService } from './ingredients.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Ingredient, RecipeIngredient])],
  controllers: [IngredientsController],
  providers: [IngredientsService],
  exports: [TypeOrmModule, IngredientsService],
})
export class IngredientsModule {}
