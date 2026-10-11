import { Unit } from './enums/unit.enum.js';
import {
  computeMacrosPerServing,
  MacroLine,
  MissingGramsPerUnitError,
} from './recipe-macros.js';

describe('computeMacrosPerServing', () => {
  const pollo = {
    name: 'Pechuga de pollo',
    caloriesPer100g: 165,
    proteinPer100g: 31,
    carbsPer100g: 0,
    fatPer100g: 3.6,
    gramsPerUnit: null,
  };
  const leche = {
    name: 'Leche',
    caloriesPer100g: 42,
    proteinPer100g: 3.4,
    carbsPer100g: 5,
    fatPer100g: 1,
  };
  const huevo = {
    name: 'Huevo',
    caloriesPer100g: 143,
    proteinPer100g: 12.6,
    carbsPer100g: 0.7,
    fatPer100g: 9.5,
    gramsPerUnit: 50,
  };

  it('calcula los macros de una línea en gramos', () => {
    const lines: MacroLine[] = [{ quantity: 200, unit: Unit.GRAMS, ingredient: pollo }];

    expect(computeMacrosPerServing(lines, 1)).toEqual({
      calories: 330,
      protein: 62,
      carbs: 0,
      fat: 7.2,
    });
  });

  it('trata los ml como gramos (densidad ~1)', () => {
    const lines: MacroLine[] = [{ quantity: 250, unit: Unit.MILLILITERS, ingredient: leche }];

    expect(computeMacrosPerServing(lines, 1)).toEqual({
      calories: 105,
      protein: 8.5,
      carbs: 12.5,
      fat: 2.5,
    });
  });

  it("convierte 'unidad' a gramos con gramsPerUnit", () => {
    const lines: MacroLine[] = [{ quantity: 3, unit: Unit.UNIT, ingredient: huevo }];

    // 3 huevos x 50 g = 150 g
    expect(computeMacrosPerServing(lines, 1)).toEqual({
      calories: 214.5,
      protein: 18.9,
      carbs: 1.05,
      fat: 14.25,
    });
  });

  it('suma todas las líneas y divide entre las porciones', () => {
    const lines: MacroLine[] = [
      { quantity: 200, unit: Unit.GRAMS, ingredient: pollo },
      { quantity: 250, unit: Unit.MILLILITERS, ingredient: leche },
    ];

    expect(computeMacrosPerServing(lines, 2)).toEqual({
      calories: 217.5,
      protein: 35.25,
      carbs: 6.25,
      fat: 4.85,
    });
  });

  it('redondea a 2 decimales', () => {
    const lines: MacroLine[] = [{ quantity: 100, unit: Unit.GRAMS, ingredient: pollo }];

    // 165 / 3 = 55.0, 31 / 3 = 10.333..., 3.6 / 3 = 1.2
    expect(computeMacrosPerServing(lines, 3)).toEqual({
      calories: 55,
      protein: 10.33,
      carbs: 0,
      fat: 1.2,
    });
  });

  it.each([undefined, null, 0])(
    "lanza MissingGramsPerUnitError si una línea en 'unidad' no tiene gramsPerUnit (%s)",
    (gramsPerUnit) => {
      const lines: MacroLine[] = [
        { quantity: 1, unit: Unit.UNIT, ingredient: { ...pollo, gramsPerUnit } },
      ];

      expect(() => computeMacrosPerServing(lines, 1)).toThrow(MissingGramsPerUnitError);
      expect(() => computeMacrosPerServing(lines, 1)).toThrow(/Pechuga de pollo/);
    },
  );

  it('sin líneas devuelve todo en 0', () => {
    expect(computeMacrosPerServing([], 1)).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });
});
