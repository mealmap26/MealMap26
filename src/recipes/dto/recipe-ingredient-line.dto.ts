import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsPositive, IsUUID, Max } from 'class-validator';
import { Unit } from '../enums/unit.enum.js';

// Una línea de ingrediente de la receta; la cantidad es para la receta completa
export class RecipeIngredientLineDto {
  @ApiProperty({ example: '3262729e-49fe-4abd-9338-22d9ee8a9f38', description: 'Id del ingrediente' })
  @IsUUID()
  ingredientId: string;

  @ApiProperty({ example: 200, description: 'Cantidad para la receta completa, máximo 2 decimales' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(99999)
  quantity: number;

  @ApiProperty({
    enum: Unit,
    example: Unit.GRAMS,
    description: "ml se calcula como g; 'unidad' solo sirve si el ingrediente tiene gramsPerUnit",
  })
  @IsEnum(Unit)
  unit: Unit;
}
