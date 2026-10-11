import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Raw, Repository } from 'typeorm';
import { conflictOnUniqueViolation } from '../common/database/pg-errors.js';
import { Ingredient } from '../ingredients/entities/ingredient.entity.js';
import { RecipeIngredient } from '../recipes/entities/recipe-ingredient.entity.js';
import { FridgeItemResponse } from './dto/fridge-response.dto.js';
import { UserIngredient } from './entities/user-ingredient.entity.js';
import {
  FridgeSuggestion,
  SuggestionRecipe,
  suggestRecipes,
} from './fridge-suggestions.js';

const ALREADY_IN_FRIDGE = 'El ingrediente ya está en tu nevera';

@Injectable()
export class FridgeService {
  constructor(
    @InjectRepository(UserIngredient)
    private readonly fridge: Repository<UserIngredient>,
    @InjectRepository(Ingredient)
    private readonly ingredients: Repository<Ingredient>,
    @InjectRepository(RecipeIngredient)
    private readonly recipeIngredients: Repository<RecipeIngredient>,
  ) {}

  async list(userId: string): Promise<FridgeItemResponse[]> {
    const items = await this.fridge.find({
      where: { userId },
      relations: { ingredient: true },
      order: { ingredient: { name: 'ASC' } },
    });
    return items.map((item) => ({
      ingredientId: item.ingredientId,
      name: item.ingredient.name,
    }));
  }

  // Si ya está en la nevera, la restricción única (userId, ingredientId) rechaza el insert
  async add(userId: string, ingredientId: string): Promise<FridgeItemResponse> {
    const ingredient = await this.ingredients.findOneBy({ id: ingredientId });
    if (!ingredient) {
      throw new NotFoundException('No existe un ingrediente con ese id');
    }

    await conflictOnUniqueViolation(
      () => this.fridge.save(this.fridge.create({ userId, ingredientId })),
      ALREADY_IN_FRIDGE,
    );
    return { ingredientId, name: ingredient.name };
  }

  async remove(userId: string, ingredientId: string): Promise<void> {
    const item = await this.fridge.findOneBy({ userId, ingredientId });
    if (!item) {
      throw new NotFoundException('El ingrediente no está en tu nevera');
    }
    await this.fridge.remove(item);
  }

  // Recetas que se pueden preparar con lo que hay en la nevera (o a las que les faltan
  // como mucho `maxMissing` ingredientes). Solo se cargan las recetas que comparten al menos
  // un ingrediente con la nevera: las demás nunca se sugieren.
  async suggestions(
    userId: string,
    maxMissing = 0,
  ): Promise<FridgeSuggestion[]> {
    const items = await this.fridge.findBy({ userId });
    if (items.length === 0) return [];

    const lines = await this.recipeIngredients.find({
      where: {
        recipeId: Raw(
          (alias) =>
            `${alias} IN (SELECT ri."recipeId" FROM "recipe_ingredients" ri
              JOIN "user_ingredients" ui ON ui."ingredientId" = ri."ingredientId"
              WHERE ui."userId" = :userId)`,
          { userId },
        ),
      },
      relations: { recipe: { category: true }, ingredient: true },
    });

    const linesByRecipe = new Map<string, RecipeIngredient[]>();
    for (const line of lines) {
      linesByRecipe.set(line.recipeId, [
        ...(linesByRecipe.get(line.recipeId) ?? []),
        line,
      ]);
    }

    const catalog: SuggestionRecipe[] = [...linesByRecipe.values()].map(
      (recipeLines) => {
        const { recipe } = recipeLines[0];
        return {
          id: recipe.id,
          name: recipe.name,
          prepTimeMinutes: recipe.prepTimeMinutes,
          calories: recipe.calories,
          protein: recipe.protein,
          carbs: recipe.carbs,
          fat: recipe.fat,
          category: { id: recipe.category.id, name: recipe.category.name },
          ingredients: recipeLines.map((line) => ({
            id: line.ingredientId,
            name: line.ingredient.name,
          })),
        };
      },
    );

    return suggestRecipes(
      catalog,
      items.map((item) => item.ingredientId),
      maxMissing,
    );
  }
}
