import { ApiProperty } from '@nestjs/swagger';
import { Unit } from '../enums/unit.enum.js';

// Clases solo para documentar en Swagger la forma de las respuestas.
// El plugin de Swagger lee los comentarios: la primera línea es la descripción y @example el ejemplo.

export class RecipeCategoryResponse {
  /**
   * Id de la categoría
   * @example 0b6f2a1e-6f0c-4d63-9a43-3f0f5b1f2c7d
   */
  id: string;

  /**
   * Nombre de la categoría
   * @example "Alto en proteína"
   */
  name: string;
}

export class RecipeSummaryResponse {
  /**
   * Id de la receta
   * @example 2d6ab013-ca11-4ca8-acfa-ee840c0a645f
   */
  id: string;

  /**
   * Nombre de la receta
   * @example "Pollo con arroz y brócoli"
   */
  name: string;

  @ApiProperty({ type: String, nullable: true, example: 'Pechuga a la plancha con arroz blanco y brócoli al vapor.' })
  description: string | null;

  /**
   * Tiempo de preparación en minutos
   * @example 30
   */
  prepTimeMinutes: number;

  /**
   * Porciones que rinde la receta completa
   * @example 2
   */
  servingSize: number;

  /**
   * Calorías por porción (kcal), calculadas a partir de los ingredientes
   * @example 685.68
   */
  calories: number;

  /**
   * Proteína por porción (g)
   * @example 70.29
   */
  protein: number;

  /**
   * Carbohidratos por porción (g)
   * @example 70.23
   */
  carbs: number;

  /**
   * Grasas por porción (g)
   * @example 12.77
   */
  fat: number;

  category: RecipeCategoryResponse;
}

export class RecipeLineResponse {
  /**
   * Id del ingrediente
   * @example 3262729e-49fe-4abd-9338-22d9ee8a9f38
   */
  ingredientId: string;

  /**
   * Nombre del ingrediente
   * @example "Pechuga de pollo"
   */
  name: string;

  /**
   * Cantidad para la receta completa
   * @example 400
   */
  quantity: number;

  @ApiProperty({ enum: Unit, example: Unit.GRAMS })
  unit: Unit;
}

export class RecipeDetailResponse extends RecipeSummaryResponse {
  /** Ingredientes de la receta completa, ordenados por nombre */
  ingredients: RecipeLineResponse[];
}
