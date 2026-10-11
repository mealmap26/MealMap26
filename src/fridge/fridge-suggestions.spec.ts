import { suggestRecipes, SuggestionRecipe } from './fridge-suggestions.js';

describe('suggestRecipes', () => {
  const category = { id: 'cat-1', name: 'Rápido' };
  const recipe = (
    id: string,
    name: string,
    ingredients: string[],
  ): SuggestionRecipe => ({
    id,
    name,
    prepTimeMinutes: 10,
    calories: 400,
    protein: 30,
    carbs: 40,
    fat: 10,
    category,
    ingredients: ingredients.map((ingredientId) => ({
      id: ingredientId,
      name: ingredientId.toUpperCase(),
    })),
  });

  const catalog = [
    recipe('r1', 'Pollo con arroz', ['pollo', 'arroz']),
    recipe('r2', 'Arroz con huevo', ['arroz', 'huevo']),
    recipe('r3', 'Ensalada', ['lechuga', 'tomate', 'pepino', 'aceite']),
    recipe('r4', 'Arroz blanco', ['arroz']),
  ];

  it('con la nevera vacía no sugiere nada', () => {
    expect(suggestRecipes(catalog, [], 5)).toEqual([]);
  });

  it('por defecto (maxMissing 0) solo devuelve las recetas que se pueden preparar completas', () => {
    const result = suggestRecipes(catalog, ['arroz', 'pollo'], 0);

    expect(result.map((s) => s.recipe.id)).toEqual(['r4', 'r1']);
    expect(result.every((s) => s.canPrepare)).toBe(true);
    expect(result[1]).toEqual({
      recipe: {
        id: 'r1',
        name: 'Pollo con arroz',
        prepTimeMinutes: 10,
        calories: 400,
        protein: 30,
        carbs: 40,
        fat: 10,
        category,
      },
      matchedIngredients: 2,
      totalIngredients: 2,
      missingIngredients: [],
      canPrepare: true,
    });
  });

  it('con maxMissing incluye las que les faltan pocos ingredientes y dice cuáles', () => {
    const result = suggestRecipes(catalog, ['arroz', 'pollo'], 1);

    const casi = result.find((s) => s.recipe.id === 'r2');
    expect(casi).toMatchObject({
      matchedIngredients: 1,
      totalIngredients: 2,
      missingIngredients: [{ id: 'huevo', name: 'HUEVO' }],
      canPrepare: false,
    });
  });

  it('ordena por faltantes, luego por proporción de coincidencia y luego por nombre', () => {
    const result = suggestRecipes(
      [
        ...catalog,
        recipe('r5', 'Arroz con pollo y huevo', ['arroz', 'pollo', 'huevo']),
        recipe('r6', 'Arepa con huevo', ['arepa', 'huevo']),
      ],
      ['arroz', 'pollo', 'lechuga', 'tomate'],
      2,
    );

    expect(result.map((s) => s.recipe.id)).toEqual([
      // 0 faltantes, mismo ratio (1) -> por nombre
      'r4',
      'r1',
      // 1 faltante: 2/3 antes que 1/2
      'r5',
      'r2',
      // 2 faltantes: 2/4
      'r3',
    ]);
  });

  it('no sugiere recetas sin ningún ingrediente de la nevera, aunque cumplan maxMissing', () => {
    const result = suggestRecipes(catalog, ['pollo'], 5);

    expect(result.map((s) => s.recipe.id)).toEqual(['r1']);
  });

  it('ignora recetas sin ingredientes', () => {
    expect(suggestRecipes([recipe('r0', 'Vacía', [])], ['arroz'], 5)).toEqual([]);
  });
});
