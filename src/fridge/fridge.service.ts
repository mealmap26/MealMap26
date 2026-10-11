import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Ingredient } from '../ingredients/entities/ingredient.entity.js';
import { RecipeIngredient } from '../recipes/entities/recipe-ingredient.entity.js';
import { Recipe } from '../recipes/entities/recipe.entity.js';
import { FridgeItemResponse } from './dto/fridge-response.dto.js';
import { UserIngredient } from './entities/user-ingredient.entity.js';
import {
  FridgeSuggestion,
  SuggestionRecipe,
  suggestRecipes,
} from './fridge-suggestions.js';

// Código de PostgreSQL para "viola una restricción única"
const UNIQUE_VIOLATION = '23505';
const ALREADY_IN_FRIDGE = 'El ingrediente ya está en tu nevera';

@Injectable()
export class FridgeService {
  constructor(
    @InjectRepository(UserIngredient)
    private readonly fridge: Repository<UserIngredient>,
    @InjectRepository(Ingredient)
    private readonly ingredients: Repository<Ingredient>,
    @InjectRepository(Recipe) private readonly recipes: Repository<Recipe>,
    @InjectRepository(RecipeIngredient)
    private readonly recipeIngredients: Repository<RecipeIngredient>,
  ) {}

  // Ingredientes de la nevera del usuario, ordenados por nombre
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

  async add(userId: string, ingredientId: string): Promise<FridgeItemResponse> {
    const ingredient = await this.ingredients.findOneBy({ id: ingredientId });
    if (!ingredient) throw new NotFoundException('No existe un ingrediente con ese id');

    if (await this.fridge.existsBy({ userId, ingredientId })) {
      throw new ConflictException(ALREADY_IN_FRIDGE);
    }
    try {
      await this.fridge.save(this.fridge.create({ userId, ingredientId }));
    } catch (error) {
      // Por si llegan dos peticiones iguales al mismo tiempo
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string } | undefined)?.code ===
          UNIQUE_VIOLATION
      ) {
        throw new ConflictException(ALREADY_IN_FRIDGE);
      }
      throw error;
    }
    return { ingredientId, name: ingredient.name };
  }

  async remove(userId: string, ingredientId: string): Promise<void> {
    const item = await this.fridge.findOneBy({ userId, ingredientId });
    if (!item) throw new NotFoundException('El ingrediente no está en tu nevera');
    await this.fridge.remove(item);
  }

  // Recetas que se pueden preparar con lo que hay en la nevera (o a las que les faltan
  // como mucho `maxMissing` ingredientes)
  async suggestions(userId: string, maxMissing = 0): Promise<FridgeSuggestion[]> {
    const items = await this.fridge.findBy({ userId });
    if (items.length === 0) return [];

    const [recipes, lines] = await Promise.all([
      this.recipes.find({ relations: { category: true } }),
      this.recipeIngredients.find({ relations: { ingredient: true } }),
    ]);

    const catalog: SuggestionRecipe[] = recipes.map((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      prepTimeMinutes: recipe.prepTimeMinutes,
      calories: recipe.calories,
      protein: recipe.protein,
      carbs: recipe.carbs,
      fat: recipe.fat,
      category: { id: recipe.category.id, name: recipe.category.name },
      ingredients: lines
        .filter((line) => line.recipeId === recipe.id)
        .map((line) => ({ id: line.ingredientId, name: line.ingredient.name })),
    }));

    return suggestRecipes(
      catalog,
      items.map((item) => item.ingredientId),
      maxMissing,
    );
  }
}
