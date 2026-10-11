import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// Ningún alimento pasa de ~900 kcal ni de 100 g de un macro por cada 100 g
const MAX_PER_100G = 900;
const MAX_GRAMS_PER_UNIT = 5000;

export class CreateIngredientDto {
  @ApiProperty({ example: 'Quinua', description: 'Nombre único (sin distinguir mayúsculas)' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: 368, description: 'Calorías por 100 g (kcal), máximo 2 decimales' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_PER_100G)
  caloriesPer100g: number;

  @ApiProperty({ example: 14.1, description: 'Proteína por 100 g (g), máximo 2 decimales' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_PER_100G)
  proteinPer100g: number;

  @ApiProperty({ example: 64.2, description: 'Carbohidratos por 100 g (g), máximo 2 decimales' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_PER_100G)
  carbsPer100g: number;

  @ApiProperty({ example: 6.1, description: 'Grasas por 100 g (g), máximo 2 decimales' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_PER_100G)
  fatPer100g: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 50,
    description: "Peso aproximado de una unidad (g). Necesario para usar el ingrediente en 'unidad' dentro de una receta",
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(MAX_GRAMS_PER_UNIT)
  gramsPerUnit?: number | null;
}
