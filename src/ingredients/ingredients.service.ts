import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, ILike, Raw, Repository } from 'typeorm';
import { escapeLike } from '../common/database/escape-like.js';
import { conflictOnUniqueViolation } from '../common/database/pg-errors.js';
import { ensureNameIsFree } from '../common/database/unique-name.js';
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

const NAME_TAKEN = 'Ya existe un ingrediente con ese nombre';

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
    await ensureNameIsFree(this.ingredients, dto.name, NAME_TAKEN);
    return conflictOnUniqueViolation(
      () =>
        this.ingredients.save(
          this.ingredients.create({
            ...dto,
            gramsPerUnit: dto.gramsPerUnit ?? null,
          }),
        ),
      NAME_TAKEN,
    );
  }

  // Todo ocurre en una transacción: las lecturas, el guardado y, si cambia algún valor
  // nutricional, el recálculo de los macros de las recetas que usan el ingrediente
  async update(id: string, dto: UpdateIngredientDto): Promise<Ingredient> {
    return conflictOnUniqueViolation(
      () =>
        this.ingredients.manager.transaction(async (manager) => {
          const repository = manager.getRepository(Ingredient);
          const ingredient = await repository.findOneBy({ id });
          if (!ingredient) {
            throw new NotFoundException('Ingrediente no encontrado');
          }
          if (dto.name !== undefined) {
            await ensureNameIsFree(repository, dto.name, NAME_TAKEN, id);
          }

          const nutritionChanged = NUTRITION_FIELDS.some(
            (field) =>
              dto[field] !== undefined && dto[field] !== ingredient[field],
          );
          const changes = Object.fromEntries(
            Object.entries(dto).filter(([, value]) => value !== undefined),
          );

          const saved = await manager.save(
            repository.merge(ingredient, changes),
          );
          if (nutritionChanged) await this.recomputeRecipesUsing(manager, id);
          return saved;
        }),
      NAME_TAKEN,
    );
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

  // Una sola consulta trae todas las líneas (con su ingrediente) de las recetas que usan el
  // ingrediente, y un solo save guarda los macros nuevos de todas ellas
  private async recomputeRecipesUsing(
    manager: EntityManager,
    ingredientId: string,
  ) {
    const lines = await manager.find(RecipeIngredient, {
      where: {
        recipeId: Raw(
          (alias) =>
            `${alias} IN (SELECT "recipeId" FROM "recipe_ingredients" WHERE "ingredientId" = :ingredientId)`,
          { ingredientId },
        ),
      },
      relations: { recipe: true, ingredient: true },
    });
    if (lines.length === 0) return;

    const linesByRecipe = new Map<string, RecipeIngredient[]>();
    for (const line of lines) {
      linesByRecipe.set(line.recipeId, [
        ...(linesByRecipe.get(line.recipeId) ?? []),
        line,
      ]);
    }

    const updates = [...linesByRecipe.values()].map((recipeLines) => {
      const { recipe } = recipeLines[0];
      try {
        return {
          id: recipe.id,
          ...computeMacrosPerServing(recipeLines, recipe.servingSize),
        };
      } catch (error) {
        if (error instanceof MissingGramsPerUnitError) {
          throw new BadRequestException(
            `No se puede quitar gramsPerUnit: la receta "${recipe.name}" usa este ingrediente en 'unidad'`,
          );
        }
        throw error;
      }
    });
    await manager.save(Recipe, updates);
  }
}
