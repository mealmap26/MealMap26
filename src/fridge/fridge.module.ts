import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ingredient } from '../ingredients/entities/ingredient.entity.js';
import { RecipeIngredient } from '../recipes/entities/recipe-ingredient.entity.js';
import { UserIngredient } from './entities/user-ingredient.entity.js';
import { FridgeController } from './fridge.controller.js';
import { FridgeService } from './fridge.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserIngredient, Ingredient, RecipeIngredient]),
  ],
  controllers: [FridgeController],
  providers: [FridgeService],
  exports: [TypeOrmModule, FridgeService],
})
export class FridgeModule {}
