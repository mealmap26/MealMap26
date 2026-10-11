export interface NamedItem {
  id: string;
  name: string;
}

// Receta del catálogo con el conjunto de ingredientes que usa
export interface SuggestionRecipe {
  id: string;
  name: string;
  prepTimeMinutes: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  category: NamedItem;
  ingredients: NamedItem[];
}

export interface FridgeSuggestion {
  recipe: Omit<SuggestionRecipe, 'ingredients'>;
  matchedIngredients: number;
  totalIngredients: number;
  missingIngredients: NamedItem[];
  canPrepare: boolean;
}

// Compara los ingredientes de cada receta con los de la nevera (sin cantidades).
// Devuelve las recetas a las que les faltan como mucho `maxMissing` ingredientes y que usan
// al menos uno de la nevera, ordenadas por: menos faltantes, mayor proporción de coincidencia
// y nombre.
export function suggestRecipes(
  recipes: SuggestionRecipe[],
  fridgeIngredientIds: Iterable<string>,
  maxMissing: number,
): FridgeSuggestion[] {
  const fridge = new Set(fridgeIngredientIds);
  if (fridge.size === 0) return [];

  const ratio = (s: FridgeSuggestion) =>
    s.matchedIngredients / s.totalIngredients;

  return recipes
    .map(({ ingredients, ...recipe }) => {
      const missingIngredients = ingredients.filter(
        (ingredient) => !fridge.has(ingredient.id),
      );
      return {
        recipe,
        matchedIngredients: ingredients.length - missingIngredients.length,
        totalIngredients: ingredients.length,
        missingIngredients,
        canPrepare: missingIngredients.length === 0,
      };
    })
    .filter(
      (s) =>
        s.matchedIngredients > 0 && s.missingIngredients.length <= maxMissing,
    )
    .sort(
      (a, b) =>
        a.missingIngredients.length - b.missingIngredients.length ||
        ratio(b) - ratio(a) ||
        a.recipe.name.localeCompare(b.recipe.name, 'es'),
    );
}
