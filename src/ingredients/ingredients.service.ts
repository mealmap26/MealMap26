import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, ILike, In, Raw, Repository } from 'typeorm';
import { RecipeIngredient } from '../recipes/entities/recipe-ingredient.entity.js';
import { Recipe } from '../recipes/entities/recipe.entity.js';
import {
  computeMacrosPerServing,
  MissingGramsPerUnitError,
} from '../recipes/recipe-macros.js';
import { CreateIngredientDto } from './dto/create-ingredient.dto.js';
import { UpdateIngredientDto } from './dto/update-ingredient.dto.js';
import { Ingredient } from './entities/ingredient.entity.js';

// Campos que, si cambian, alteran los macros de las recetas que usan el ingrediente
const NUTRITION_FIELDS = [
  'caloriesPer100g',
  'proteinPer100g',
  'carbsPer100g',
  'fatPer100g',
  'gramsPerUnit',
] as const;

// Escapa los comodines de LIKE para buscar el texto tal cual
const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

@Injectable()
export class IngredientsService {
  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredients: Repository<Ingredient>,
    @InjectRepository(RecipeIngredient)
    private readonly recipeIngredients: Repository<RecipeIngredient>,
  ) {}

  findAll(search?: string): Promise<Ingredient[]> {
    return this.ingredients.find({
      where: search ? { name: ILike(`%${escapeLike(search)}%`) } : {},
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Ingredient> {
    const ingredient = await this.ingredients.findOneBy({ id });
    if (!ingredient) throw new NotFoundException('Ingrediente no encontrado');
    return ingredient;
  }

  async create(dto: CreateIngredientDto): Promise<Ingredient> {
    await this.ensureNameIsFree(dto.name);
    return this.ingredients.save(
      this.ingredients.create({ ...dto, gramsPerUnit: dto.gramsPerUnit ?? null }),
    );
  }

  // Si cambia algún valor nutricional, en la misma transacción se recalculan los macros
  // de todas las recetas que usan el ingrediente
  async update(id: string, dto: UpdateIngredientDto): Promise<Ingredient> {
    const ingredient = await this.findOne(id);
    if (dto.name !== undefined) await this.ensureNameIsFree(dto.name, id);

    const nutritionChanged = NUTRITION_FIELDS.some(
      (field) => dto[field] !== undefined && dto[field] !== ingredient[field],
    );
    const changes = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );
    const updated = this.ingredients.merge(ingredient, changes);

    return this.ingredients.manager.transaction(async (manager) => {
      const saved = await manager.save(updated);
      if (nutritionChanged) await this.recomputeRecipesUsing(manager, id);
      return saved;
    });
  }

  // No se puede borrar un ingrediente que esté en alguna receta (la llave foránea es RESTRICT).
  // De las neveras sí se quita solo (ON DELETE CASCADE).
  async remove(id: string): Promise<void> {
    const ingredient = await this.findOne(id);
    if (await this.recipeIngredients.existsBy({ ingredientId: id })) {
      throw new ConflictException(
        'No se puede eliminar el ingrediente porque está en uso en alguna receta',
      );
    }
    await this.ingredients.remove(ingredient);
  }

  private async recomputeRecipesUsing(manager: EntityManager, ingredientId: string) {
    const usages = await manager.find(RecipeIngredient, { where: { ingredientId } });
    const recipeIds = [...new Set(usages.map((usage) => usage.recipeId))];
    if (recipeIds.length === 0) return;

    const recipes = await manager.find(Recipe, { where: { id: In(recipeIds) } });
    const lines = await manager.find(RecipeIngredient, {
      where: { recipeId: In(recipeIds) },
      relations: { ingredient: true },
    });

    for (const recipe of recipes) {
      try {
        const macros = computeMacrosPerServing(
          lines.filter((line) => line.recipeId === recipe.id),
          recipe.servingSize,
        );
        await manager.update(Recipe, { id: recipe.id }, macros);
      } catch (error) {
        if (error instanceof MissingGramsPerUnitError) {
          throw new BadRequestException(
            `No se puede quitar gramsPerUnit: la receta "${recipe.name}" usa este ingrediente en 'unidad'`,
          );
        }
        throw error;
      }
    }
  }

  // El nombre es único sin distinguir mayúsculas
  private async ensureNameIsFree(name: string, excludeId?: string) {
    const existing = await this.ingredients.findOneBy({
      name: Raw((alias) => `LOWER(${alias}) = LOWER(:name)`, { name }),
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Ya existe un ingrediente con ese nombre');
    }
  }
}
