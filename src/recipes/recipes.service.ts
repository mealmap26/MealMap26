import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  FindOptionsWhere,
  ILike,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  QueryFailedError,
  Raw,
  Repository,
} from 'typeorm';
import { Category } from '../categories/entities/category.entity.js';
import { Ingredient } from '../ingredients/entities/ingredient.entity.js';
import { MealPlanEntry } from '../meal-plan/entities/meal-plan-entry.entity.js';
import { CreateRecipeDto } from './dto/create-recipe.dto.js';
import { ListRecipesQueryDto } from './dto/list-recipes-query.dto.js';
import { RecipeIngredientLineDto } from './dto/recipe-ingredient-line.dto.js';
import {
  RecipeDetailResponse,
  RecipeSummaryResponse,
} from './dto/recipe-response.dto.js';
import { UpdateRecipeDto } from './dto/update-recipe.dto.js';
import { RecipeIngredient } from './entities/recipe-ingredient.entity.js';
import { Recipe } from './entities/recipe.entity.js';
import {
  computeMacrosPerServing,
  MacroLine,
  Macros,
  MissingGramsPerUnitError,
} from './recipe-macros.js';

// Código de PostgreSQL para "viola una llave foránea"
const FOREIGN_KEY_VIOLATION = '23503';
const IN_USE_BY_A_PLAN =
  'No se puede eliminar la receta porque está asignada en algún plan semanal';

// Escapa los comodines de LIKE para buscar el texto tal cual
const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

@Injectable()
export class RecipesService {
  constructor(
    @InjectRepository(Recipe) private readonly recipes: Repository<Recipe>,
    @InjectRepository(RecipeIngredient)
    private readonly recipeIngredients: Repository<RecipeIngredient>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(Ingredient)
    private readonly ingredients: Repository<Ingredient>,
    @InjectRepository(MealPlanEntry)
    private readonly mealPlanEntries: Repository<MealPlanEntry>,
  ) {}

  async findAll(query: ListRecipesQueryDto): Promise<RecipeSummaryResponse[]> {
    const where: FindOptionsWhere<Recipe> = {};
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.search) where.name = ILike(`%${escapeLike(query.search)}%`);
    if (query.maxPrepTime !== undefined) {
      where.prepTimeMinutes = LessThanOrEqual(query.maxPrepTime);
    }
    if (query.maxCalories !== undefined) {
      where.calories = LessThanOrEqual(query.maxCalories);
    }
    if (query.minProtein !== undefined) {
      where.protein = MoreThanOrEqual(query.minProtein);
    }

    const recipes = await this.recipes.find({
      where,
      relations: { category: true },
      order: { name: 'ASC' },
    });
    return recipes.map((recipe) => this.toSummary(recipe));
  }

  async findOne(id: string): Promise<RecipeDetailResponse> {
    const recipe = await this.recipes.findOne({
      where: { id },
      relations: { category: true },
    });
    if (!recipe) throw new NotFoundException('Receta no encontrada');

    const lines = await this.recipeIngredients.find({
      where: { recipeId: id },
      relations: { ingredient: true },
      order: { ingredient: { name: 'ASC' } },
    });

    return {
      ...this.toSummary(recipe),
      ingredients: lines.map((line) => ({
        ingredientId: line.ingredientId,
        name: line.ingredient.name,
        quantity: line.quantity,
        unit: line.unit,
      })),
    };
  }

  // Crea la receta y sus líneas en una sola transacción; los macros se calculan aquí
  async create(dto: CreateRecipeDto): Promise<RecipeDetailResponse> {
    await this.ensureNameIsFree(dto.name);
    await this.ensureCategoryExists(dto.categoryId);
    const macros = this.computeMacros(
      dto.ingredients,
      await this.findIngredients(dto.ingredients),
      dto.servingSize,
    );

    const recipeId = await this.recipes.manager.transaction(async (manager) => {
      const recipe = await manager.save(
        manager.create(Recipe, {
          name: dto.name,
          description: dto.description ?? null,
          prepTimeMinutes: dto.prepTimeMinutes,
          servingSize: dto.servingSize,
          categoryId: dto.categoryId,
          ...macros,
        }),
      );
      await manager.save(this.buildLines(manager, recipe.id, dto.ingredients));
      return recipe.id;
    });

    return this.findOne(recipeId);
  }

  // Si llegan `ingredients` se reemplazan todas las líneas. Los macros se recalculan
  // cuando cambian los ingredientes o las porciones.
  async update(id: string, dto: UpdateRecipeDto): Promise<RecipeDetailResponse> {
    const recipe = await this.recipes.findOneBy({ id });
    if (!recipe) throw new NotFoundException('Receta no encontrada');

    if (dto.name !== undefined) await this.ensureNameIsFree(dto.name, id);
    if (dto.categoryId !== undefined) {
      await this.ensureCategoryExists(dto.categoryId);
    }

    const servingSize = dto.servingSize ?? recipe.servingSize;
    let macros: Macros | undefined;
    if (dto.ingredients) {
      macros = this.computeMacros(
        dto.ingredients,
        await this.findIngredients(dto.ingredients),
        servingSize,
      );
    } else if (servingSize !== recipe.servingSize) {
      const lines = await this.recipeIngredients.find({
        where: { recipeId: id },
        relations: { ingredient: true },
      });
      macros = computeMacrosPerServing(lines, servingSize);
    }

    const { ingredients: newLines, ...fields } = dto;
    const changes: Partial<Recipe> = {
      ...Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== undefined),
      ),
      ...macros,
    };

    await this.recipes.manager.transaction(async (manager) => {
      if (newLines) {
        await manager.delete(RecipeIngredient, { recipeId: id });
        await manager.save(this.buildLines(manager, id, newLines));
      }
      if (Object.keys(changes).length > 0) {
        await manager.update(Recipe, { id }, changes);
      }
    });

    return this.findOne(id);
  }

  // No se puede borrar una receta asignada en un plan (la llave foránea es RESTRICT).
  // Sus líneas de ingredientes se borran solas (ON DELETE CASCADE).
  async remove(id: string): Promise<void> {
    const recipe = await this.recipes.findOneBy({ id });
    if (!recipe) throw new NotFoundException('Receta no encontrada');

    if (await this.mealPlanEntries.existsBy({ recipeId: id })) {
      throw new ConflictException(IN_USE_BY_A_PLAN);
    }
    try {
      await this.recipes.remove(recipe);
    } catch (error) {
      // Por si un plan la tomó entre la verificación y el borrado
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string } | undefined)?.code ===
          FOREIGN_KEY_VIOLATION
      ) {
        throw new ConflictException(IN_USE_BY_A_PLAN);
      }
      throw error;
    }
  }

  private toSummary(recipe: Recipe): RecipeSummaryResponse {
    return {
      id: recipe.id,
      name: recipe.name,
      description: recipe.description,
      prepTimeMinutes: recipe.prepTimeMinutes,
      servingSize: recipe.servingSize,
      calories: recipe.calories,
      protein: recipe.protein,
      carbs: recipe.carbs,
      fat: recipe.fat,
      category: { id: recipe.category.id, name: recipe.category.name },
    };
  }

  private buildLines(
    manager: EntityManager,
    recipeId: string,
    lines: RecipeIngredientLineDto[],
  ) {
    return lines.map((line) =>
      manager.create(RecipeIngredient, {
        recipeId,
        ingredientId: line.ingredientId,
        quantity: line.quantity,
        unit: line.unit,
      }),
    );
  }

  // Trae los ingredientes de las líneas; si falta alguno, dice cuáles
  private async findIngredients(
    lines: RecipeIngredientLineDto[],
  ): Promise<Map<string, Ingredient>> {
    const ids = lines.map((line) => line.ingredientId);
    const found = await this.ingredients.findBy({ id: In(ids) });
    const byId = new Map(found.map((ingredient) => [ingredient.id, ingredient]));

    const missing = ids.filter((ingredientId) => !byId.has(ingredientId));
    if (missing.length > 0) {
      throw new NotFoundException(
        `No existen los ingredientes: ${missing.join(', ')}`,
      );
    }
    return byId;
  }

  private computeMacros(
    lines: RecipeIngredientLineDto[],
    ingredients: Map<string, Ingredient>,
    servingSize: number,
  ): Macros {
    const macroLines: MacroLine[] = lines.map((line) => ({
      quantity: line.quantity,
      unit: line.unit,
      ingredient: ingredients.get(line.ingredientId) as Ingredient,
    }));
    try {
      return computeMacrosPerServing(macroLines, servingSize);
    } catch (error) {
      if (error instanceof MissingGramsPerUnitError) {
        throw new BadRequestException(
          `El ingrediente "${error.ingredientName}" no tiene gramsPerUnit: usa g o ml, o configúralo con PATCH /ingredients/:id`,
        );
      }
      throw error;
    }
  }

  private async ensureCategoryExists(categoryId: string) {
    if (!(await this.categories.existsBy({ id: categoryId }))) {
      throw new NotFoundException(`No existe la categoría ${categoryId}`);
    }
  }

  // El nombre es único sin distinguir mayúsculas
  private async ensureNameIsFree(name: string, excludeId?: string) {
    const existing = await this.recipes.findOneBy({
      name: Raw((alias) => `LOWER(${alias}) = LOWER(:name)`, { name }),
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Ya existe una receta con ese nombre');
    }
  }
}
