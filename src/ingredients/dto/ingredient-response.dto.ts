import { ApiProperty } from '@nestjs/swagger';

// Clase solo para documentar en Swagger la forma de la respuesta.
export class IngredientResponse {
  /**
   * Id del ingrediente
   * @example 3262729e-49fe-4abd-9338-22d9ee8a9f38
   */
  id: string;

  /**
   * Nombre del ingrediente
   * @example "Huevo"
   */
  name: string;

  /**
   * Calorías por 100 g (kcal)
   * @example 143
   */
  caloriesPer100g: number;

  /**
   * Proteína por 100 g (g)
   * @example 12.6
   */
  proteinPer100g: number;

  /**
   * Carbohidratos por 100 g (g)
   * @example 0.7
   */
  carbsPer100g: number;

  /**
   * Grasas por 100 g (g)
   * @example 9.5
   */
  fatPer100g: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 50,
    description: 'Peso aproximado de una unidad (g); null si no aplica',
  })
  gramsPerUnit: number | null;
}
