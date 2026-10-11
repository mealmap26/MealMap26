import { Unit } from './enums/unit.enum.js';

// Valores nutricionales de un ingrediente (por 100 g)
export interface MacroSource {
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  // Peso de una unidad (g); solo hace falta para las líneas en 'unidad'
  gramsPerUnit?: number | null;
}

// Una línea de la receta: cantidad para la receta completa
export interface MacroLine {
  quantity: number;
  unit: Unit;
  ingredient: MacroSource;
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// Una línea en 'unidad' no se puede convertir a gramos si el ingrediente no tiene gramsPerUnit
export class MissingGramsPerUnitError extends Error {
  constructor(readonly ingredientName: string) {
    super(
      `El ingrediente "${ingredientName}" no tiene gramsPerUnit; no se puede usar en 'unidad'`,
    );
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Suma los macros de cada ingrediente y los divide entre las porciones de la receta.
// ml se trata como g (densidad ~1); 'unidad' usa gramsPerUnit del ingrediente.
export function computeMacrosPerServing(
  lines: MacroLine[],
  servingSize: number,
): Macros {
  const total = { calories: 0, protein: 0, carbs: 0, fat: 0 };

  for (const { quantity, unit, ingredient } of lines) {
    let grams = quantity;
    if (unit === Unit.UNIT) {
      if (!ingredient.gramsPerUnit) {
        throw new MissingGramsPerUnitError(ingredient.name);
      }
      grams = quantity * ingredient.gramsPerUnit;
    }
    const factor = grams / 100;
    total.calories += ingredient.caloriesPer100g * factor;
    total.protein += ingredient.proteinPer100g * factor;
    total.carbs += ingredient.carbsPer100g * factor;
    total.fat += ingredient.fatPer100g * factor;
  }

  return {
    calories: round2(total.calories / servingSize),
    protein: round2(total.protein / servingSize),
    carbs: round2(total.carbs / servingSize),
    fat: round2(total.fat / servingSize),
  };
}
