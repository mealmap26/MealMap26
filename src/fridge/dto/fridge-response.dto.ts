// Clases solo para documentar en Swagger la forma de las respuestas.
// El plugin de Swagger lee los comentarios: la primera línea es la descripción y @example el ejemplo.

export class FridgeItemResponse {
  /**
   * Id del ingrediente
   * @example 3262729e-49fe-4abd-9338-22d9ee8a9f38
   */
  ingredientId: string;

  /**
   * Nombre del ingrediente
   * @example "Arroz blanco"
   */
  name: string;
}

export class SuggestionCategoryResponse {
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

export class SuggestedRecipeResponse {
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

  /**
   * Tiempo de preparación en minutos
   * @example 30
   */
  prepTimeMinutes: number;

  /**
   * Calorías por porción (kcal)
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

  category: SuggestionCategoryResponse;
}

export class MissingIngredientResponse {
  /**
   * Id del ingrediente que falta
   * @example 8a1d3c55-2b8f-4d0e-9a51-0c7f3e1b2a44
   */
  id: string;

  /**
   * Nombre del ingrediente que falta
   * @example "Brócoli"
   */
  name: string;
}

export class FridgeSuggestionResponse {
  recipe: SuggestedRecipeResponse;

  /**
   * Ingredientes de la receta que están en la nevera
   * @example 4
   */
  matchedIngredients: number;

  /**
   * Ingredientes que usa la receta
   * @example 5
   */
  totalIngredients: number;

  /** Ingredientes que faltan (vacío si se puede preparar) */
  missingIngredients: MissingIngredientResponse[];

  /**
   * true si están todos los ingredientes
   * @example false
   */
  canPrepare: boolean;
}
